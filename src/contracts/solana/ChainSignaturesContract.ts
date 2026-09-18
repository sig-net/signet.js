import { type AnchorProvider, Program, type Idl } from '@coral-xyz/anchor'
import { hex } from '@scure/base'
import {
  type AccountMeta,
  Connection,
  PublicKey,
  type Signer,
  Transaction,
  type TransactionInstruction,
} from '@solana/web3.js'
import {
  normalizeToUncompressedPubKey,
  verifyRecoveredAddress,
} from '@utils/cryptography'
import { getRootPublicKey } from '@utils/publicKey'

import { CHAINS, KDF_CHAIN_IDS } from '@constants'
import { ChainSignatureContract as AbstractChainSignatureContract } from '@contracts/ChainSignatureContract'
import type { SignArgs } from '@contracts/ChainSignatureContract'
import type {
  RootPublicKey,
  RSVSignature,
  UncompressedPubKeySEC1,
} from '@types'
import { cryptography } from '@utils'

import type { SignOptions, SignatureErrorData } from '../evm/types'

import { SignatureNotFoundError, SigningError } from './errors'
import { HttpTransactionConfirmer } from './HttpTransactionConfirmer'
import { SolanaEventPoller } from './SolanaEventPoller'
import { type ChainSignaturesProject } from './types/chain_signatures_project'
import IDL from './types/chain_signatures_project.json'
import type {
  SignatureErrorEvent,
  SignatureRespondedEvent,
  RespondBidirectionalEvent,
  ChainSignaturesEventName,
  EventResult,
  RespondBidirectionalData,
} from './types/events'
import { getRequestIdRespond } from './utils'

export class ChainSignatureContract extends AbstractChainSignatureContract {
  private readonly provider: AnchorProvider
  private readonly program: Program<ChainSignaturesProject>
  private readonly programId: PublicKey
  private readonly rootPublicKey: UncompressedPubKeySEC1
  private readonly requesterAddress: string
  private readonly _connection: Connection
  private closed = false
  private eventPoller?: SolanaEventPoller
  private transactionConfirmer?: HttpTransactionConfirmer
  private readonly ownsPoller: boolean
  private readonly ownsConfirmer: boolean

  /**
   * Creates a new instance of the ChainSignatureContract for Solana chains.
   *
   * @param args - Configuration options for the contract
   * @param args.provider - An Anchor Provider for interacting with Solana
   * @param args.programId - The program ID as a string or PublicKey
   * @param args.config - Optional configuration
   * @param args.config.rootPublicKey - Optional root public key. If not provided, it will be derived from the program ID
   * @param args.config.requesterAddress - Provider wallet address is always the fee payer but requester can be overridden
   * @param args.config.idl - Optional custom IDL. If not provided, the default ChainSignatures IDL will be used
   * @param args.config.disableRetryOnRateLimit - If true, disables @solana/web3.js automatic retry on 429 responses. Useful when the shared HTTP poller should own retry and backoff behavior.
   */
  constructor(args: {
    provider: AnchorProvider
    programId: string | PublicKey
    eventPoller?: SolanaEventPoller
    transactionConfirmer?: HttpTransactionConfirmer
    config?: {
      rootPublicKey?: RootPublicKey
      requesterAddress?: string
      idl?: ChainSignaturesProject & Idl
      disableRetryOnRateLimit?: boolean
    }
  }) {
    super()
    this.eventPoller = args.eventPoller
    this.transactionConfirmer = args.transactionConfirmer
    this.ownsPoller = !args.eventPoller
    this.ownsConfirmer = !args.transactionConfirmer
    this.provider = args.provider
    this.requesterAddress =
      args.config?.requesterAddress ?? this.provider.wallet.publicKey.toString()

    this.programId =
      typeof args.programId === 'string'
        ? new PublicKey(args.programId)
        : args.programId

    if (
      args.eventPoller &&
      (!args.eventPoller.programId.equals(this.programId) ||
        args.eventPoller.connection.rpcEndpoint !==
          this.provider.connection.rpcEndpoint)
    )
      throw new Error(
        'Event poller must match the contract program and RPC endpoint'
      )
    if (
      args.transactionConfirmer &&
      args.transactionConfirmer.connection.rpcEndpoint !==
        this.provider.connection.rpcEndpoint
    )
      throw new Error('Transaction confirmer must match the RPC endpoint')

    const idl = args.config?.idl || (IDL as ChainSignaturesProject & Idl)
    this.program = new Program<ChainSignaturesProject>(
      { ...idl, address: this.programId.toString() },
      this.provider
    )

    const rootPublicKey =
      args.config?.rootPublicKey ||
      getRootPublicKey(this.programId.toString(), CHAINS.SOLANA)

    if (!rootPublicKey) {
      throw new Error(
        `Invalid public key, please provide a valid root public key or program ID`
      )
    }

    this.rootPublicKey = normalizeToUncompressedPubKey(rootPublicKey)

    if (args.config?.disableRetryOnRateLimit !== undefined) {
      this._connection = new Connection(this.provider.connection.rpcEndpoint, {
        commitment: this.provider.connection.commitment,
        disableRetryOnRateLimit: args.config.disableRetryOnRateLimit,
        fetch: async (input, init) => {
          const res = await globalThis.fetch(input, init)
          if (res.status === 429) {
            let method = 'unknown'
            try {
              const body = JSON.parse(init?.body as string)
              method = Array.isArray(body)
                ? body.map((r: { method: string }) => r.method).join(', ')
                : (body.method ?? 'unknown')
            } catch {}
            console.warn(
              `\n[429 TRACE] RPC method: ${method}\n${new Error().stack}`
            )
          }
          return res
        },
      })
    } else {
      this._connection = this.provider.connection
    }
  }

  /**
   * Gets the connection, using the override if `disableRetryOnRateLimit` was configured.
   */
  get connection(): Connection {
    return this._connection
  }

  async getCurrentSignatureDeposit(): Promise<bigint> {
    try {
      const programStatePDA = await this.getProgramStatePDA()

      const programState =
        await this.program.account.programState.fetch(programStatePDA)

      return BigInt(programState.signatureDeposit.toString())
    } catch (error) {
      throw new Error(
        `Failed to get signature deposit: ${
          error instanceof Error ? error.message : String(error)
        }`,
        { cause: error }
      )
    }
  }

  /**
   * Get the Program State PDA
   */
  async getProgramStatePDA(): Promise<PublicKey> {
    const [pda] = PublicKey.findProgramAddressSync(
      [new TextEncoder().encode('program-state')],
      this.programId
    )
    return pda
  }

  async getDerivedPublicKey(args: {
    path: string
    predecessor: string
    keyVersion: number
  }): Promise<UncompressedPubKeySEC1> {
    const pubKey = cryptography.deriveChildPublicKey(
      await this.getPublicKey(),
      args.predecessor,
      args.path,
      KDF_CHAIN_IDS.SOLANA,
      args.keyVersion
    )

    return pubKey
  }

  async getPublicKey(): Promise<UncompressedPubKeySEC1> {
    return this.rootPublicKey
  }

  async getSignRequestInstruction(
    args: SignArgs,
    options?: Pick<SignOptions, 'sign'> & {
      remainingAccounts?: AccountMeta[]
    }
  ): Promise<TransactionInstruction> {
    const fixedRemainingAccounts: AccountMeta[] = [
      {
        pubkey: PublicKey.findProgramAddressSync(
          [new TextEncoder().encode('__event_authority')],
          this.program.programId
        )[0],
        isWritable: false,
        isSigner: false,
      },
      {
        pubkey: this.program.programId,
        isWritable: false,
        isSigner: false,
      },
    ]

    return await this.program.methods
      .sign(
        Array.from(args.payload),
        args.key_version,
        args.path,
        options?.sign?.algo || '',
        options?.sign?.dest || '',
        options?.sign?.params || ''
      )
      .accounts({
        requester: this.requesterAddress,
        feePayer: this.provider.wallet.publicKey,
        program: this.programId,
      })
      .remainingAccounts([
        ...fixedRemainingAccounts,
        ...(options?.remainingAccounts ?? []),
      ])
      .instruction()
  }

  /**
   * Sends a transaction to the program to request a signature, then
   * observes the result through a shared HTTP event poller.
   * If the signature is not found within the timeout, it will throw an error.
   */
  async sign(
    args: SignArgs,
    options?: Partial<SignOptions> & {
      remainingAccounts?: AccountMeta[]
      remainingSigners?: Signer[]
    }
  ): Promise<RSVSignature> {
    const algo = options?.sign?.algo ?? ''
    const dest = options?.sign?.dest ?? ''
    const params = options?.sign?.params ?? ''
    const delay = options?.retry?.delay ?? 5000
    const retryCount = options?.retry?.retryCount ?? 12
    const timeoutMs = delay * retryCount

    const missingSigners = options?.remainingAccounts
      ?.filter((acc) => acc.isSigner)
      ?.some(
        (acc) =>
          !options?.remainingSigners?.some((signer) =>
            signer.publicKey.equals(acc.pubkey)
          )
      )

    if (missingSigners) {
      throw new Error(
        'All accounts marked as signers must have a corresponding signer'
      )
    }

    const requestId = this.getRequestId(args, {
      algo,
      dest,
      params,
    })

    const instruction = await this.getSignRequestInstruction(args, {
      sign: {
        algo,
        dest,
        params,
      },
      remainingAccounts: options?.remainingAccounts,
    })
    const transaction = new Transaction().add(instruction)
    transaction.feePayer = this.provider.wallet.publicKey
    await this.prepareEventPolling()
    const abort = new AbortController()
    const resultPromise = this.waitForEvent({
      eventName: 'signatureRespondedEvent',
      requestId,
      signer: this.programId,
      timeoutMs: timeoutMs + 60_000,
      signal: abort.signal,
    })
    void resultPromise.catch(() => undefined)
    let hash: string
    try {
      hash = await this.sendAndConfirmWithoutWebSocket(
        transaction,
        options?.remainingSigners
      )
    } catch (error) {
      abort.abort(error)
      throw error
    }

    const deadline = setTimeout(
      () => abort.abort(new SignatureNotFoundError(requestId)),
      timeoutMs
    )
    try {
      const result = await resultPromise

      const isValid = await verifyRecoveredAddress(
        result,
        args.payload,
        this.requesterAddress,
        args.path,
        this,
        args.key_version
      )

      if (!isValid) {
        throw new SigningError(
          requestId,
          { hash },
          new Error(
            'Signature verification failed: recovered address does not match expected address'
          )
        )
      }

      return result
    } catch (error) {
      if (error instanceof SignatureNotFoundError) {
        throw error
      } else {
        throw new SigningError(
          requestId,
          { hash },
          error instanceof Error ? error : undefined
        )
      }
    } finally {
      clearTimeout(deadline)
      abort.abort()
    }
  }

  /** Establish event observation before sending a request. */
  async prepareEventPolling(): Promise<void> {
    await this.getEventPoller().start()
  }

  private getEventPoller(): SolanaEventPoller {
    if (this.closed) throw new Error('Contract closed')
    this.eventPoller ??= new SolanaEventPoller({
      connection: this.connection,
      programId: this.programId,
      idl: this.program.idl,
    })
    return this.eventPoller
  }

  /** Close resources owned by this contract. Injected services belong to their caller. */
  close(): void {
    this.closed = true
    if (this.ownsPoller) this.eventPoller?.close()
    if (this.ownsConfirmer) this.transactionConfirmer?.close()
  }

  /** Sign, submit and confirm a transaction exclusively through HTTP RPC. */
  async sendAndConfirmWithoutWebSocket(
    transaction: Transaction,
    signers: Signer[] = []
  ): Promise<string> {
    if (this.closed || this.transactionConfirmer?.isClosed)
      throw new Error('Contract confirmation service closed')
    const { blockhash, lastValidBlockHeight } =
      await this.connection.getLatestBlockhash('confirmed')
    transaction.recentBlockhash = blockhash
    transaction.feePayer ??= this.provider.wallet.publicKey
    transaction = await this.provider.wallet.signTransaction(transaction)
    if (this.closed || this.transactionConfirmer?.isClosed)
      throw new Error('Contract confirmation service closed')
    if (signers.length) transaction.partialSign(...signers)
    const signature = await this.connection.sendRawTransaction(
      transaction.serialize(),
      {
        skipPreflight: false,
        preflightCommitment: 'confirmed',
        maxRetries: 3,
      }
    )
    this.transactionConfirmer ??= new HttpTransactionConfirmer(this.connection)
    return await this.transactionConfirmer.wait(signature, lastValidBlockHeight)
  }

  /** Waiters share the contract's HTTP event poller. Start it before submission. */
  async waitForEvent<E extends ChainSignaturesEventName>(options: {
    eventName: E
    requestId: string
    signer: PublicKey
    afterSignature?: string
    timeoutMs?: number
    /** @deprecated Configure pollIntervalMs on the shared poller. */
    backfillIntervalMs?: number
    /** @deprecated Configure pageSize on the shared poller. */
    backfillLimit?: number
    /** @deprecated HTTP polling has no WebSocket health check. */
    healthCheckIntervalMs?: number
    signal?: AbortSignal
  }): Promise<EventResult<E>> {
    const data = await this.getEventPoller().waitForEvent(
      options.eventName,
      options.requestId,
      options
    )
    const result = this.mapEventForName(
      options.eventName,
      data as never,
      options.requestId
    )
    if (result === undefined) throw new Error('Unexpected event result')
    return result
  }

  /** Build a bidirectional request without submitting or waiting for it. */
  async getSignBidirectionalInstruction(
    args: {
      serializedTransaction: Buffer
      caip2Id: string
      keyVersion: number
      path: string
      algo: string
      dest: string
      params: string
      outputDeserializationSchema: Buffer
      respondSerializationSchema: Buffer
      callbackProgramId?: PublicKey
    },
    accounts: { requester: PublicKey; feePayer: PublicKey }
  ): Promise<TransactionInstruction> {
    return await this.program.methods
      .signBidirectional(
        args.serializedTransaction,
        args.caip2Id,
        args.keyVersion,
        args.path,
        args.algo,
        args.dest,
        args.params,
        args.callbackProgramId ?? PublicKey.default,
        args.outputDeserializationSchema,
        args.respondSerializationSchema
      )
      .accounts({ ...accounts, instructions: null, program: this.programId })
      .instruction()
  }

  private mapRespondToResult(
    data: SignatureRespondedEvent,
    requestId: string
  ): RSVSignature | undefined {
    const eventRequestIdHex = '0x' + hex.encode(new Uint8Array(data.requestId))
    if (eventRequestIdHex !== requestId) return undefined
    return {
      r: hex.encode(new Uint8Array(data.signature.bigR.x)),
      s: hex.encode(new Uint8Array(data.signature.s)),
      v: data.signature.recoveryId + 27,
    }
  }

  private mapRespondErrorToResult(
    data: SignatureErrorEvent,
    requestId: string
  ): SignatureErrorData | undefined {
    const eventRequestIdHex = '0x' + hex.encode(new Uint8Array(data.requestId))
    if (eventRequestIdHex !== requestId) return undefined
    return {
      requestId: eventRequestIdHex,
      error: data.error,
    }
  }

  private mapRespondBidirectionalToResult(
    data: RespondBidirectionalEvent,
    requestId: string
  ): RespondBidirectionalData | undefined {
    const eventRequestIdHex = '0x' + hex.encode(new Uint8Array(data.requestId))
    if (eventRequestIdHex !== requestId) return undefined
    return {
      serializedOutput: data.serializedOutput,
      signature: data.signature,
    }
  }

  private mapEventForName<E extends ChainSignaturesEventName>(
    eventName: E,
    data:
      SignatureRespondedEvent | SignatureErrorEvent | RespondBidirectionalEvent,
    requestId: string
  ): EventResult<E> | undefined {
    switch (eventName) {
      case 'signatureRespondedEvent':
        return this.mapRespondToResult(
          data as SignatureRespondedEvent,
          requestId
        ) as EventResult<E> | undefined
      case 'signatureErrorEvent':
        return this.mapRespondErrorToResult(
          data as SignatureErrorEvent,
          requestId
        ) as EventResult<E> | undefined
      case 'respondBidirectionalEvent':
        return this.mapRespondBidirectionalToResult(
          data as RespondBidirectionalEvent,
          requestId
        ) as EventResult<E> | undefined
      default:
        return undefined
    }
  }

  /**
   * Generates the request ID for a signature request allowing to track the response.
   */
  getRequestId(
    args: SignArgs,
    options: SignOptions['sign'] = {
      algo: '',
      dest: '',
      params: '',
    }
  ): string {
    return getRequestIdRespond({
      payload: args.payload,
      path: args.path,
      keyVersion: args.key_version,
      algo: options.algo || '',
      dest: options.dest || '',
      params: options.params || '',
      address: this.requesterAddress,
      chainId: KDF_CHAIN_IDS.SOLANA,
    })
  }
}
