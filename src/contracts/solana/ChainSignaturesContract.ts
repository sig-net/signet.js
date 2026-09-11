import { type AnchorProvider, Program, type Idl } from '@coral-xyz/anchor'
import { hex } from '@scure/base'
import {
  type AccountMeta,
  Connection,
  PublicKey,
  type Signer,
  Transaction,
  type TransactionInstruction,
  TransactionExpiredTimeoutError,
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
import { EventWatcher } from './EventWatcher'
import { type ChainSignaturesProject } from './types/chain_signatures_project'
import IDL from './types/chain_signatures_project.json'
import type {
  SignatureErrorEvent,
  SignatureRespondedEvent,
  RespondBidirectionalEvent,
  ChainSignaturesEventName,
  EventData,
  EventResult,
  RespondBidirectionalData,
} from './types/events'
import { getRequestIdRespond } from './utils'

/** Options shared by `sign` and `submitSignRequest`. */
export interface SubmitSignRequestOptions {
  sign?: SignOptions['sign']
  remainingAccounts?: AccountMeta[]
  remainingSigners?: Signer[]
  /**
   * Whether to wait until the sign transaction is confirmed before returning.
   * Defaults to true. A caller that tracks confirmations itself, for instance
   * in one batched `getSignatureStatuses` call across many requests, sets it
   * to false and gets the signature back as soon as the RPC accepts the
   * transaction.
   */
  waitForConfirmation?: boolean
}

export interface SubmittedSignRequest {
  /** The id the MPC network echoes back in its response event. */
  requestId: string
  /** Signature of the Solana transaction that carried the sign request. */
  txSignature: string
}

const CONFIRMATION_TIMEOUT_MS = 30_000
const CONFIRMATION_POLL_MS = 2_000

export class ChainSignatureContract extends AbstractChainSignatureContract {
  private readonly provider: AnchorProvider
  private readonly program: Program<ChainSignaturesProject>
  /** The chain-signatures program, and the address whose logs carry its events. */
  readonly programId: PublicKey
  private readonly rootPublicKey: UncompressedPubKeySEC1
  private readonly requesterAddress: string
  private readonly _connection: Connection
  /** One watcher per watched address, shared by every concurrent wait. */
  private readonly watchers = new Map<string, EventWatcher>()

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
   * @param args.config.disableRetryOnRateLimit - If true, disables @solana/web3.js automatic retry on 429 responses. Recommended when using the built-in backfill mechanism.
   * @param args.config.traceRateLimits - If true, logs the RPC method and a stack trace for every 429 response. Only meaningful with `disableRetryOnRateLimit` set; off by default because each trace is expensive under sustained rate limiting.
   */
  constructor(args: {
    provider: AnchorProvider
    programId: string | PublicKey
    config?: {
      rootPublicKey?: RootPublicKey
      requesterAddress?: string
      idl?: ChainSignaturesProject & Idl
      disableRetryOnRateLimit?: boolean
      traceRateLimits?: boolean
    }
  }) {
    super()
    this.provider = args.provider
    this.requesterAddress =
      args.config?.requesterAddress ?? this.provider.wallet.publicKey.toString()

    this.programId =
      typeof args.programId === 'string'
        ? new PublicKey(args.programId)
        : args.programId

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
        fetch: args.config.traceRateLimits ? traceRateLimitedFetch : undefined,
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
   * Sends the sign request transaction and returns as soon as it is confirmed
   * (or accepted, with `waitForConfirmation: false`), without waiting for the
   * MPC response. Pair with `waitForEvent` to collect the signature later, or
   * to collect many signatures concurrently over one shared subscription.
   */
  async submitSignRequest(
    args: SignArgs,
    options?: SubmitSignRequestOptions
  ): Promise<SubmittedSignRequest> {
    const sign = {
      algo: options?.sign?.algo ?? '',
      dest: options?.sign?.dest ?? '',
      params: options?.sign?.params ?? '',
    }

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

    const requestId = this.getRequestId(args, sign)
    const instruction = await this.getSignRequestInstruction(args, {
      sign,
      remainingAccounts: options?.remainingAccounts,
    })
    const transaction = new Transaction().add(instruction)
    transaction.feePayer = this.provider.wallet.publicKey

    const txSignature = await this.sendTransaction(
      transaction,
      options?.remainingSigners
    )
    if (options?.waitForConfirmation ?? true) {
      await this.confirmTransaction(txSignature)
    }

    return { requestId, txSignature }
  }

  /**
   * Requests a signature and waits for the MPC network's response.
   *
   * Composes `submitSignRequest` with `waitForEvent`, then verifies that the
   * returned signature recovers to the requester's derived address.
   */
  async sign(
    args: SignArgs,
    options?: Partial<SignOptions> & {
      remainingAccounts?: AccountMeta[]
      remainingSigners?: Signer[]
    }
  ): Promise<RSVSignature> {
    const delay = options?.retry?.delay ?? 5000
    const retryCount = options?.retry?.retryCount ?? 12
    const timeoutMs = delay * retryCount

    const { requestId, txSignature } = await this.submitSignRequest(args, {
      sign: options?.sign,
      remainingAccounts: options?.remainingAccounts,
      remainingSigners: options?.remainingSigners,
    })

    try {
      const result = await this.waitForEvent({
        eventName: 'signatureRespondedEvent',
        requestId,
        signer: this.programId,
        afterSignature: txSignature,
        timeoutMs,
        backfillIntervalMs: delay,
      })

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
          { hash: txSignature },
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
          { hash: txSignature },
          error instanceof Error ? error : undefined
        )
      }
    }
  }

  private async sendTransaction(
    transaction: Transaction,
    signers?: Signer[]
  ): Promise<string> {
    const { blockhash } = await this.connection.getLatestBlockhash('confirmed')
    transaction.recentBlockhash = blockhash

    transaction = await this.provider.wallet.signTransaction(transaction)

    if (signers && signers.length > 0) {
      transaction.partialSign(...signers)
    }

    return await this.connection.sendRawTransaction(transaction.serialize(), {
      skipPreflight: false,
      preflightCommitment: 'processed',
      maxRetries: 3,
    })
  }

  /**
   * Polls the transaction's status over HTTP until it is confirmed, so no
   * websocket subscription is needed for the send path.
   */
  private async confirmTransaction(signature: string): Promise<void> {
    const startTime = Date.now()

    while (Date.now() - startTime < CONFIRMATION_TIMEOUT_MS) {
      const status = await this.connection.getSignatureStatus(signature)

      if (status.value?.err) {
        throw new Error(
          `Transaction failed: ${JSON.stringify(status.value.err)}`
        )
      }

      if (
        status.value?.confirmationStatus === 'confirmed' ||
        status.value?.confirmationStatus === 'finalized'
      ) {
        return
      }

      await new Promise((resolve) => setTimeout(resolve, CONFIRMATION_POLL_MS))
    }

    throw new TransactionExpiredTimeoutError(
      signature,
      CONFIRMATION_TIMEOUT_MS / 1000
    )
  }

  private watcherFor(address: PublicKey): EventWatcher {
    const key = address.toString()
    let watcher = this.watchers.get(key)
    if (!watcher) {
      watcher = new EventWatcher({
        connection: this.connection,
        program: this.program as unknown as Program<Idl>,
        address,
      })
      this.watchers.set(key, watcher)
    }
    return watcher
  }

  /**
   * Waits for the event named `eventName` carrying `requestId`.
   *
   * Every wait on the same `signer` shares one log subscription and one
   * backfill loop, so the RPC cost of many concurrent waits is that of a
   * single one. The subscription opens with the first waiter and closes with
   * the last. An event that arrived before its waiter registered is served
   * from a bounded cache of recently seen events.
   */
  async waitForEvent<E extends ChainSignaturesEventName>(options: {
    eventName: E
    requestId: string
    /** The account whose log stream carries the event, normally the program. */
    signer: PublicKey
    afterSignature?: string
    timeoutMs?: number
    backfillIntervalMs?: number
    backfillLimit?: number
    healthCheckIntervalMs?: number
    signal?: AbortSignal
  }): Promise<EventResult<E>> {
    const { eventName, requestId, signer, ...waitOptions } = options
    const data = await this.watcherFor(signer).waitForEvent(
      eventName,
      requestId,
      waitOptions
    )
    return this.mapEventForName(eventName, data)
  }

  private mapRespondToResult(data: SignatureRespondedEvent): RSVSignature {
    return {
      r: hex.encode(new Uint8Array(data.signature.bigR.x)),
      s: hex.encode(new Uint8Array(data.signature.s)),
      v: data.signature.recoveryId + 27,
    }
  }

  private mapRespondErrorToResult(
    data: SignatureErrorEvent
  ): SignatureErrorData {
    return {
      requestId: '0x' + hex.encode(new Uint8Array(data.requestId)),
      error: data.error,
    }
  }

  private mapRespondBidirectionalToResult(
    data: RespondBidirectionalEvent
  ): RespondBidirectionalData {
    return {
      serializedOutput: data.serializedOutput,
      signature: data.signature,
    }
  }

  private mapEventForName<E extends ChainSignaturesEventName>(
    eventName: E,
    data: EventData<E>
  ): EventResult<E> {
    switch (eventName) {
      case 'signatureRespondedEvent':
        return this.mapRespondToResult(
          data as SignatureRespondedEvent
        ) as EventResult<E>
      case 'signatureErrorEvent':
        return this.mapRespondErrorToResult(
          data as SignatureErrorEvent
        ) as EventResult<E>
      case 'respondBidirectionalEvent':
        return this.mapRespondBidirectionalToResult(
          data as RespondBidirectionalEvent
        ) as EventResult<E>
      default:
        throw new Error(`Unknown event: ${String(eventName)}`)
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

/**
 * A fetch that names the RPC method and captures a stack trace on every 429,
 * which is what locates the caller responsible for a rate-limit storm.
 */
const traceRateLimitedFetch: typeof globalThis.fetch = async (input, init) => {
  const res = await globalThis.fetch(input, init)
  if (res.status === 429) {
    let method = 'unknown'
    try {
      const body = JSON.parse(init?.body as string)
      method = Array.isArray(body)
        ? body.map((r: { method: string }) => r.method).join(', ')
        : (body.method ?? 'unknown')
    } catch {}
    console.warn(`\n[429 TRACE] RPC method: ${method}\n${new Error().stack}`)
  }
  return res
}
