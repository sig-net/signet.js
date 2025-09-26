import { type AnchorProvider, Program, EventParser } from '@coral-xyz/anchor'
import {
  type AccountMeta,
  PublicKey,
  type Signer,
  Transaction,
  type TransactionInstruction,
  TransactionExpiredTimeoutError,
  type Connection,
} from '@solana/web3.js'
import { najToUncompressedPubKeySEC1 } from '@utils/cryptography'
import { getRootPublicKey } from '@utils/publicKey'
import BN from 'bn.js'

import { CHAINS, KDF_CHAIN_IDS } from '@constants'
import { ChainSignatureContract as AbstractChainSignatureContract } from '@contracts/ChainSignatureContract'
import type { SignArgs } from '@contracts/ChainSignatureContract'
import type { NajPublicKey, RSVSignature, UncompressedPubKeySEC1 } from '@types'
import { cryptography } from '@utils'

import type {
  RetryOptions,
  SignOptions,
  SignatureErrorData,
} from '../evm/types'

import { CpiEventParser } from './CpiEventParser'
import {
  SignatureNotFoundError,
  SignatureContractError,
  SigningError,
} from './errors'
import { type ChainSignaturesProject } from './types/chain_signatures_project'
import IDL from './types/chain_signatures_project.json'
import type {
  SignatureErrorEvent,
  SignatureRespondedEvent,
  ChainSignaturesEventName,
} from './types/events'
import { generateRequestIdSolana } from './utils'

export class ChainSignatureContract extends AbstractChainSignatureContract {
  private readonly provider: AnchorProvider
  private readonly program: Program<ChainSignaturesProject>
  private readonly programId: PublicKey
  private readonly rootPublicKey: NajPublicKey
  private readonly requesterAddress: string

  /**
   * Creates a new instance of the ChainSignatureContract for Solana chains.
   *
   * @param args - Configuration options for the contract
   * @param args.provider - An Anchor Provider for interacting with Solana
   * @param args.programId - The program ID as a string or PublicKey
   * @param args.rootPublicKey - Optional root public key. If not provided, it will be derived from the program ID
   * @param args.requesterAddress - Provider wallet address is always the fee payer but requester can be overridden
   */
  constructor(args: {
    provider: AnchorProvider
    programId: string | PublicKey
    rootPublicKey?: NajPublicKey
    requesterAddress?: string
  }) {
    super()
    this.provider = args.provider
    this.requesterAddress =
      args.requesterAddress ?? this.provider.wallet.publicKey.toString()

    this.programId =
      typeof args.programId === 'string'
        ? new PublicKey(args.programId)
        : args.programId

    this.program = new Program<ChainSignaturesProject>(
      { ...IDL, address: this.programId.toString() },
      this.provider
    )

    const rootPublicKey =
      args.rootPublicKey ||
      getRootPublicKey(this.programId.toString(), CHAINS.SOLANA)

    if (!rootPublicKey) {
      throw new Error(
        `Invalid public key, please provide a valid root public key or program ID`
      )
    }

    this.rootPublicKey = rootPublicKey
  }

  /**
   * Gets the connection from the provider
   */
  get connection(): Connection {
    return this.provider.connection
  }

  async getCurrentSignatureDeposit(): Promise<BN> {
    try {
      const programStatePDA = await this.getProgramStatePDA()

      const programState =
        await this.program.account.programState.fetch(programStatePDA)

      return new BN(programState.signatureDeposit.toString())
    } catch (error) {
      throw new Error(
        `Failed to get signature deposit: ${
          error instanceof Error ? error.message : String(error)
        }`
      )
    }
  }

  /**
   * Get the Program State PDA
   */
  async getProgramStatePDA(): Promise<PublicKey> {
    const [pda] = PublicKey.findProgramAddressSync(
      [Buffer.from('program-state')],
      this.programId
    )
    return pda
  }

  async getDerivedPublicKey(args: {
    path: string
    predecessor: string
  }): Promise<UncompressedPubKeySEC1> {
    const pubKey = cryptography.deriveChildPublicKey(
      await this.getPublicKey(),
      args.predecessor,
      args.path,
      KDF_CHAIN_IDS.SOLANA
    )

    return pubKey
  }

  async getPublicKey(): Promise<UncompressedPubKeySEC1> {
    return najToUncompressedPubKeySEC1(this.rootPublicKey)
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
          [Buffer.from('__event_authority')],
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
      })
      .remainingAccounts([
        ...fixedRemainingAccounts,
        ...(options?.remainingAccounts ?? []),
      ])
      .instruction()
  }

  /**
   * Sends a transaction to the program to request a signature, then
   * polls for the signature result. If the signature is not found within the retry
   * parameters, it will throw an error.
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
    const hash = await this.sendAndConfirmWithoutWebSocket(
      transaction,
      options?.remainingSigners
    )

    try {
      const pollResult = await this.pollForRequestId({
        requestId,
        payload: args.payload,
        path: args.path,
        afterSignature: hash,
        options: {
          delay,
          retryCount,
        },
      })

      if (!pollResult) {
        throw new SignatureNotFoundError(requestId, { hash })
      }

      if ('error' in pollResult) {
        throw new SignatureContractError(pollResult.error, requestId, { hash })
      }

      return pollResult
    } catch (error) {
      if (
        error instanceof SignatureNotFoundError ||
        error instanceof SignatureContractError
      ) {
        throw error
      } else {
        throw new SigningError(
          requestId,
          { hash },
          error instanceof Error ? error : undefined
        )
      }
    }
  }

  private async sendAndConfirmWithoutWebSocket(
    transaction: Transaction,
    signers?: Signer[]
  ): Promise<string> {
    const { blockhash } =
      await this.provider.connection.getLatestBlockhash('confirmed')
    transaction.recentBlockhash = blockhash

    transaction = await this.provider.wallet.signTransaction(transaction)

    if (signers && signers.length > 0) {
      transaction.partialSign(...signers)
    }

    const signature = await this.provider.connection.sendRawTransaction(
      transaction.serialize(),
      {
        skipPreflight: false,
        preflightCommitment: 'processed',
        maxRetries: 3,
      }
    )

    const startTime = Date.now()
    const timeout = 30000 // 30 seconds, same as default sendAndConfirm

    while (Date.now() - startTime < timeout) {
      const status =
        await this.provider.connection.getSignatureStatus(signature)

      if (status.value?.err) {
        throw new Error(
          `Transaction failed: ${JSON.stringify(status.value.err)}`
        )
      }

      if (
        status.value?.confirmationStatus === 'confirmed' ||
        status.value?.confirmationStatus === 'finalized'
      ) {
        return signature
      }

      await new Promise((resolve) => setTimeout(resolve, 2000))
    }

    throw new TransactionExpiredTimeoutError(signature, timeout / 1000)
  }

  /**
   * Polls for signature or error events matching the given requestId starting from the solana transaction with signature afterSignature.
   * Returns a signature, error data, or undefined if nothing is found.
   */
  async pollForRequestId({
    requestId,
    payload: _payload,
    path: _path,
    afterSignature,
    options,
  }: {
    requestId: string
    payload: number[]
    path: string
    afterSignature: string
    options?: RetryOptions
  }): Promise<RSVSignature | SignatureErrorData | undefined> {
    const delay = options?.delay ?? 5000
    const retryCount = options?.retryCount ?? 12

    let lastCheckedSignature = afterSignature

    for (let i = 0; i < retryCount; i++) {
      try {
        // Get all transactions since last check
        const signatures = await this.connection.getSignaturesForAddress(
          this.programId,
          {
            until: lastCheckedSignature,
            limit: 50,
          },
          'confirmed'
        )

        if (signatures.length > 0) {
          lastCheckedSignature = signatures[signatures.length - 1].signature
        }

        for (const sig of signatures) {
          const tx = await this.connection.getParsedTransaction(sig.signature, {
            commitment: 'confirmed',
            maxSupportedTransactionVersion: 0,
          })

          if (tx?.meta?.logMessages) {
            const result = await this.parseLogsForEvents(
              tx.meta.logMessages,
              requestId,
              sig.signature
            )

            if (result) {
              return result
            }
          }
        }
      } catch (error) {
        console.error('Error checking for events:', error)
      }

      if (i < retryCount - 1) {
        console.log(`Retrying get signature: ${i + 1}/${retryCount}`)
        await new Promise((resolve) => setTimeout(resolve, delay))
      }
    }

    return undefined
  }

  /**
   * Parses transaction logs for signature or error events.
   */
  private async parseLogsForEvents(
    logs: string[],
    requestId: string,
    signature: string
  ): Promise<RSVSignature | SignatureErrorData | undefined> {
    const cpiEvents = await CpiEventParser.parseCpiEvents(
      this.connection,
      signature,
      this.programId.toString(),
      this.program
    )
    for (const event of cpiEvents) {
      const mapped = this.mapEventToResult(
        event.name,
        event.name === 'signatureRespondedEvent' ? event.data : event.data,
        requestId
      )
      if (mapped) return mapped
    }

    // 2) Parse regular Anchor events from logs (emit!)
    const parser = new EventParser(this.program.programId, this.program.coder)
    for (const evt of parser.parseLogs(logs)) {
      if (!evt) continue
      const mapped = this.mapEventToResult(
        evt.name as ChainSignaturesEventName,
        evt.name === 'signatureRespondedEvent'
          ? (evt.data as SignatureRespondedEvent)
          : (evt.data as SignatureErrorEvent),
        requestId
      )
      if (mapped) return mapped
    }

    return undefined
  }

  private mapEventToResult(
    name: ChainSignaturesEventName,
    data: SignatureRespondedEvent | SignatureErrorEvent,
    requestId: string
  ): RSVSignature | SignatureErrorData | undefined {
    const eventRequestIdHex = '0x' + Buffer.from(data.requestId).toString('hex')
    if (name === 'signatureRespondedEvent' && eventRequestIdHex === requestId) {
      const d = data as SignatureRespondedEvent
      return {
        r: Buffer.from(d.signature.bigR.x).toString('hex'),
        s: Buffer.from(d.signature.s).toString('hex'),
        v: d.signature.recoveryId + 27,
      }
    }
    if (name === 'signatureErrorEvent' && eventRequestIdHex === requestId) {
      const d = data as SignatureErrorEvent
      return {
        requestId: eventRequestIdHex,
        error: d.error,
      }
    }
    return undefined
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
    return generateRequestIdSolana({
      payload: args.payload,
      path: args.path,
      keyVersion: args.key_version,
      algo: options.algo || '',
      dest: options.dest || '',
      params: options.params || '',
      address: this.requesterAddress,
    })
  }

  /**
   * Subscribes to program events using Anchor's EventParser for regular events,
   * and CPI parsing for emit_cpi!-emitted events. Returns an unsubscribe fn.
   */
  async subscribeToEvents(handlers: {
    onSignatureResponded?: (
      event: SignatureRespondedEvent,
      slot: number
    ) => Promise<void> | void
    onSignatureError?: (
      event: SignatureErrorEvent,
      slot: number
    ) => Promise<void> | void
  }): Promise<() => Promise<void>> {
    const commitment: 'processed' | 'confirmed' | 'finalized' = 'confirmed'
    // Subscribe to CPI events (emit_cpi!)
    const cpiHandlers = new Map<
      ChainSignaturesEventName,
      (
        event: SignatureRespondedEvent | SignatureErrorEvent,
        slot: number
      ) => Promise<void>
    >()
    if (handlers.onSignatureResponded) {
      const onSignatureResponded = handlers.onSignatureResponded
      cpiHandlers.set('signatureRespondedEvent', async (e, s) => {
        await onSignatureResponded(e as SignatureRespondedEvent, s)
      })
    }
    if (handlers.onSignatureError) {
      const onSignatureError = handlers.onSignatureError
      cpiHandlers.set('signatureErrorEvent', async (e, s) => {
        await onSignatureError(e as SignatureErrorEvent, s)
      })
    }
    const cpiSubId = CpiEventParser.subscribeToCpiEvents(
      this.connection,
      this.program,
      cpiHandlers
    )

    const parser = new EventParser(this.program.programId, this.program.coder)
    const subId = this.connection.onLogs(
      this.program.programId,
      (logs, context) => {
        if (logs.err) return
        for (const evt of parser.parseLogs(logs.logs)) {
          if (!evt) continue
          if (evt.name === 'signatureRespondedEvent') {
            const onSignatureResponded = handlers.onSignatureResponded
            if (onSignatureResponded) {
              void onSignatureResponded(
                evt.data as SignatureRespondedEvent,
                context.slot
              )
            }
          }
          if (evt.name === 'signatureErrorEvent') {
            const onSignatureError = handlers.onSignatureError
            if (onSignatureError) {
              void onSignatureError(
                evt.data as SignatureErrorEvent,
                context.slot
              )
            }
          }
        }
      },
      commitment
    )

    return async () => {
      await this.connection.removeOnLogsListener(subId)
      await this.connection.removeOnLogsListener(cpiSubId)
    }
  }
}
