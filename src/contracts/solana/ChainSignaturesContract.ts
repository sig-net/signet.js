import {
  type AnchorProvider,
  Program,
  EventParser,
  type Idl,
} from '@coral-xyz/anchor'
import {
  type AccountMeta,
  PublicKey,
  type Signer,
  Transaction,
  type TransactionInstruction,
  TransactionExpiredTimeoutError,
  type Connection,
} from '@solana/web3.js'
import {
  najToUncompressedPubKeySEC1,
  verifyRecoveredAddress,
} from '@utils/cryptography'
import { getRootPublicKey } from '@utils/publicKey'
import BN from 'bn.js'

import { CHAINS, KDF_CHAIN_IDS } from '@constants'
import { ChainSignatureContract as AbstractChainSignatureContract } from '@contracts/ChainSignatureContract'
import type { SignArgs } from '@contracts/ChainSignatureContract'
import type { NajPublicKey, RSVSignature, UncompressedPubKeySEC1 } from '@types'
import { cryptography } from '@utils'

import type { SignOptions, SignatureErrorData } from '../evm/types'

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
  private readonly rootPublicKey: NajPublicKey
  private readonly requesterAddress: string

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
   */
  constructor(args: {
    provider: AnchorProvider
    programId: string | PublicKey
    config?: {
      rootPublicKey?: NajPublicKey
      requesterAddress?: string
      idl?: ChainSignaturesProject & Idl
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
   * races a WebSocket listener against polling backfill to find the result.
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
    const hash = await this.sendAndConfirmWithoutWebSocket(
      transaction,
      options?.remainingSigners
    )

    const controller = new AbortController()
    const successPromise = this.waitForEvent({
      eventName: 'signatureRespondedEvent',
      requestId,
      signer: this.programId,
      afterSignature: hash,
      timeoutMs,
      backfillIntervalMs: delay,
      signal: controller.signal,
    })
    const errorPromise = this.waitForEvent({
      eventName: 'signatureErrorEvent',
      requestId,
      signer: this.programId,
      afterSignature: hash,
      timeoutMs,
      backfillIntervalMs: delay,
      signal: controller.signal,
    }).then((err) => {
      throw new SignatureContractError(err.error, requestId, { hash })
    })

    // Prevent unhandled rejection warnings from the losing racer
    successPromise.catch(() => {})
    errorPromise.catch(() => {})

    try {
      const result = await Promise.race([successPromise, errorPromise])

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
    } finally {
      controller.abort()
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
   * Waits for a specific event matching the given requestId by combining
   * a WebSocket listener (real-time) with polling backfill (resilience).
   */
  async waitForEvent<E extends ChainSignaturesEventName>(options: {
    eventName: E
    requestId: string
    signer: PublicKey
    afterSignature?: string
    timeoutMs?: number
    backfillIntervalMs?: number
    backfillLimit?: number
    signal?: AbortSignal
  }): Promise<EventResult<E>> {
    const {
      eventName,
      requestId,
      signer,
      afterSignature,
      timeoutMs = 60_000,
      backfillIntervalMs = 5_000,
      backfillLimit = 50,
      signal,
    } = options

    return await new Promise<EventResult<E>>((resolve, reject) => {
      let settled = false
      const seenSignatures = new Set<string>()
      let lastCheckedSignature = afterSignature
      const cleanupFns: Array<() => void> = []

      const cleanup = (): void => {
        for (const fn of cleanupFns) {
          try {
            fn()
          } catch {}
        }
      }

      const settle = (action: () => void): void => {
        if (settled) return
        settled = true
        cleanup()
        action()
      }

      const processEvent = (
        name: string,
        data:
          | SignatureRespondedEvent
          | SignatureErrorEvent
          | RespondBidirectionalEvent,
        txSignature?: string
      ): boolean => {
        if (settled) return false
        if (txSignature && seenSignatures.has(txSignature)) return false
        if (txSignature) seenSignatures.add(txSignature)
        if (name !== eventName) return false

        const result = this.mapEventForName<E>(eventName, data, requestId)
        if (result !== undefined) {
          settle(() => {
            resolve(result)
          })
          return true
        }
        return false
      }

      // AbortSignal listener
      if (signal) {
        if (signal.aborted) {
          settle(() => {
            reject(signal.reason ?? new Error('Aborted'))
          })
          return
        }
        const onAbort = (): void => {
          settle(() => {
            reject(signal.reason ?? new Error('Aborted'))
          })
        }
        signal.addEventListener('abort', onAbort, { once: true })
        cleanupFns.push(() => {
          signal.removeEventListener('abort', onAbort)
        })
      }

      // Timeout
      const timeoutId = setTimeout(() => {
        settle(() => {
          reject(new SignatureNotFoundError(requestId))
        })
      }, timeoutMs)
      cleanupFns.push(() => {
        clearTimeout(timeoutId)
      })

      // WebSocket subscription
      const parser = new EventParser(this.program.programId, this.program.coder)
      const subId = this.connection.onLogs(
        signer,
        (logs, _context) => {
          if (settled) return
          if (logs.err) return

          for (const evt of parser.parseLogs(logs.logs)) {
            if (!evt) continue
            if (
              processEvent(
                evt.name,
                evt.data as
                  | SignatureRespondedEvent
                  | SignatureErrorEvent
                  | RespondBidirectionalEvent,
                logs.signature
              )
            )
              return
          }

          void CpiEventParser.fetchAndParseCpiEvents(
            this.connection,
            logs.signature,
            this.programId.toString(),
            this.program
          ).then((cpiEvents) => {
            for (const event of cpiEvents) {
              if (processEvent(event.name, event.data, logs.signature)) return
            }
          })
        },
        'confirmed'
      )
      cleanupFns.push(() => {
        void this.connection.removeOnLogsListener(subId)
      })

      // Backfill polling
      const runBackfill = async (): Promise<void> => {
        if (settled) return
        try {
          const signatures = await this.connection.getSignaturesForAddress(
            signer,
            {
              until: lastCheckedSignature,
              limit: backfillLimit,
            },
            'confirmed'
          )

          if (signatures.length > 0) {
            lastCheckedSignature = signatures[0].signature
          }

          for (const sig of signatures) {
            if (settled) return
            if (seenSignatures.has(sig.signature)) continue

            const tx = await this.connection.getParsedTransaction(
              sig.signature,
              {
                commitment: 'confirmed',
                maxSupportedTransactionVersion: 0,
              }
            )
            if (!tx) continue

            const cpiEvents = CpiEventParser.parseCpiEventsFromTransaction(
              tx,
              this.programId.toString(),
              this.program
            )
            for (const event of cpiEvents) {
              if (processEvent(event.name, event.data, sig.signature)) return
            }

            const logs = tx.meta?.logMessages
            if (logs) {
              for (const evt of parser.parseLogs(logs)) {
                if (!evt) continue
                if (
                  processEvent(
                    evt.name,
                    evt.data as
                      | SignatureRespondedEvent
                      | SignatureErrorEvent
                      | RespondBidirectionalEvent,
                    sig.signature
                  )
                )
                  return
              }
            }
          }
        } catch {
          // Backfill errors are non-fatal; next interval will retry
        }
      }

      void runBackfill()

      const intervalId = setInterval(() => {
        void runBackfill()
      }, backfillIntervalMs)
      cleanupFns.push(() => {
        clearInterval(intervalId)
      })
    })
  }

  private mapRespondToResult(
    data: SignatureRespondedEvent,
    requestId: string
  ): RSVSignature | undefined {
    const eventRequestIdHex = '0x' + Buffer.from(data.requestId).toString('hex')
    if (eventRequestIdHex !== requestId) return undefined
    return {
      r: Buffer.from(data.signature.bigR.x).toString('hex'),
      s: Buffer.from(data.signature.s).toString('hex'),
      v: data.signature.recoveryId + 27,
    }
  }

  private mapRespondErrorToResult(
    data: SignatureErrorEvent,
    requestId: string
  ): SignatureErrorData | undefined {
    const eventRequestIdHex = '0x' + Buffer.from(data.requestId).toString('hex')
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
    const eventRequestIdHex = '0x' + Buffer.from(data.requestId).toString('hex')
    if (eventRequestIdHex !== requestId) return undefined
    return {
      serializedOutput: data.serializedOutput,
      signature: data.signature,
    }
  }

  private mapEventForName<E extends ChainSignaturesEventName>(
    eventName: E,
    data:
      | SignatureRespondedEvent
      | SignatureErrorEvent
      | RespondBidirectionalEvent,
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
