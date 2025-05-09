import { AnchorProvider, Program, Wallet } from '@coral-xyz/anchor'
import {
  AccountMeta,
  PublicKey,
  Signer,
  Transaction,
  TransactionInstruction,
} from '@solana/web3.js'
import BN from 'bn.js'
import { concat, createPublicClient, http, padHex, recoverAddress } from 'viem'

import { CHAINS, KDF_CHAIN_IDS } from '@constants'
import { ChainSignatureContract as AbstractChainSignatureContract } from '@contracts/ChainSignatureContract'
import type { SignArgs } from '@contracts/ChainSignatureContract'
import type { NajPublicKey, RSVSignature, UncompressedPubKeySEC1 } from '@types'
import { cryptography } from '@utils'
import { getRootPublicKey } from '@utils/publicKey'
import { najToUncompressedPubKeySEC1 } from '@utils/cryptography'
import { ChainSignaturesProject } from './types/chain_signatures_project'
import IDL from './types/chain_signatures_project.json'

import {
  SignatureNotFoundError,
  SignatureContractError,
  SigningError,
} from './errors'
import type {
  RetryOptions,
  SignOptions,
  SignatureErrorData,
} from '../evm/types'
import { generateRequestIdSolana } from './utils'
import { chainAdapters } from '../..'
import { SignatureErrorEvent, SignatureRespondedEvent } from './types/events'

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
  get connection() {
    return this.provider.connection
  }

  async getCurrentSignatureDeposit(): Promise<BN> {
    try {
      const programStatePDA = await this.getProgramStatePDA()

      const programState =
        await this.program.account.programState.fetch(programStatePDA)

      return new BN(programState.signatureDeposit.toString())
    } catch (error) {
      throw new Error(`Failed to get signature deposit: ${error}`)
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
      remainingAccounts?: Array<AccountMeta>
    }
  ): Promise<TransactionInstruction> {
    return this.program.methods
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
      .remainingAccounts(options?.remainingAccounts ?? [])
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
      remainingAccounts?: Array<AccountMeta>
      remainingSigners?: Array<Signer>
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

    const eventPromise = this.listenForSignatureEvents({
      requestId,
      payload: args.payload,
      path: args.path,
      options: {
        delay,
        retryCount,
      },
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
    const hash = await this.provider.sendAndConfirm(
      transaction,
      options?.remainingSigners
    )

    try {
      const pollResult = await eventPromise

      if (!pollResult) {
        throw new SignatureNotFoundError(requestId, { hash })
      }

      if ('error' in pollResult) {
        throw new SignatureContractError(pollResult.error, requestId, { hash })
      }

      return pollResult as RSVSignature
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

  /**
   * Listens for signature or error events matching the given requestId.
   * Sets up listeners for both event types and returns a promise that resolves when
   * either a valid signature or an error is received.
   */
  async listenForSignatureEvents({
    requestId,
    payload,
    path,
    options,
  }: {
    requestId: string
    payload: number[]
    path: string
    options?: RetryOptions
  }): Promise<RSVSignature | SignatureErrorData | undefined> {
    const delay = options?.delay ?? 5000
    const retryCount = options?.retryCount ?? 12
    const timeout = delay * retryCount

    return new Promise((resolve, reject) => {
      let resolved = false
      let signatureListener: number
      let errorListener: number
      const timeoutId = setTimeout(() => {
        if (!resolved) {
          this.program.removeEventListener(signatureListener)
          this.program.removeEventListener(errorListener)
          reject(new SignatureNotFoundError(requestId))
        }
      }, timeout)

      signatureListener = this.program.addEventListener(
        'signatureRespondedEvent',
        (event: SignatureRespondedEvent) => {
          const eventRequestIdHex =
            '0x' + Buffer.from(event.requestId).toString('hex')
          if (eventRequestIdHex === requestId) {
            const signature = event.signature
            const bigRx = Buffer.from(signature.bigR.x).toString('hex')
            const s = Buffer.from(signature.s).toString('hex')
            const recoveryId = signature.recoveryId

            const rsvSignature: RSVSignature = {
              r: bigRx,
              s: s,
              v: recoveryId + 27,
            }

            // Verify the signature using ecrecover
            const sig = concat([
              padHex(`0x${rsvSignature.r}`, { size: 32 }),
              padHex(`0x${rsvSignature.s}`, { size: 32 }),
              `0x${rsvSignature.v.toString(16)}`,
            ])

            const verifySignature = async () => {
              try {
                const evm = new chainAdapters.evm.EVM({
                  publicClient: createPublicClient({
                    transport: http('https://dontcare.com'),
                  }),
                  contract: this,
                })

                const { address: expectedAddress } =
                  await evm.deriveAddressAndPublicKey(
                    this.requesterAddress,
                    path
                  )

                const recoveredAddress = await recoverAddress({
                  hash: new Uint8Array(payload),
                  signature: sig,
                })

                if (
                  recoveredAddress.toLowerCase() ===
                  expectedAddress.toLowerCase()
                ) {
                  resolved = true
                  clearTimeout(timeoutId)
                  this.program.removeEventListener(signatureListener)
                  this.program.removeEventListener(errorListener)
                  resolve(rsvSignature)
                } else {
                  console.warn('Signature verification failed, ignoring event')
                }
              } catch (e) {
                console.error('Error verifying signature:', e)
              }
            }

            verifySignature()
          }
        }
      )

      errorListener = this.program.addEventListener(
        'signatureErrorEvent',
        (event: SignatureErrorEvent) => {
          const eventRequestIdHex =
            '0x' + Buffer.from(event.requestId).toString('hex')
          if (eventRequestIdHex === requestId) {
            resolved = true
            clearTimeout(timeoutId)
            this.program.removeEventListener(signatureListener)
            this.program.removeEventListener(errorListener)

            resolve({
              requestId: '0x' + Buffer.from(event.requestId).toString('hex'),
              error: event.error,
            })
          }
        }
      )
    })
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
}
