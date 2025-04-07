import { AnchorProvider, Program, Wallet } from '@coral-xyz/anchor'
import { PublicKey } from '@solana/web3.js'
import BN from 'bn.js'
import {
  concat,
  createPublicClient,
  http,
  padHex,
  recoverAddress,
  withRetry,
} from 'viem'

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
import { signature } from 'bitcoinjs-lib/src/script'

export class ChainSignatureContract extends AbstractChainSignatureContract {
  private readonly provider: AnchorProvider
  private readonly program: Program<ChainSignaturesProject>
  private readonly programId: PublicKey
  private readonly rootPublicKey: NajPublicKey

  /**
   * Creates a new instance of the ChainSignatureContract for Solana chains.
   *
   * @param args - Configuration options for the contract
   * @param args.provider - An Anchor Provider for interacting with Solana
   * @param args.programId - The program ID as a string or PublicKey
   * @param args.rootPublicKey - Optional root public key. If not provided, it will be derived from the program ID
   */
  constructor(args: {
    provider: AnchorProvider
    programId: string | PublicKey
    rootPublicKey?: NajPublicKey
  }) {
    super()
    this.provider = args.provider

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

  /**
   * Sends a transaction to the program to request a signature, then
   * polls for the signature result. If the signature is not found within the retry
   * parameters, it will throw an error.
   */
  async sign(
    args: SignArgs & { feePayer?: Wallet },
    options: SignOptions = {
      sign: {
        algo: '',
        dest: '',
        params: '',
      },
      retry: {
        delay: 5000,
        retryCount: 12,
      },
    }
  ): Promise<RSVSignature> {
    const wallet = this.provider.wallet

    const feePayer = args.feePayer || wallet

    const requestId = this.getRequestId(args, options.sign)

    const hash = await this.program.methods
      .sign(
        Array.from(args.payload),
        args.key_version,
        args.path,
        options.sign?.algo || '',
        options.sign?.dest || '',
        options.sign?.params || ''
      )
      .accounts({
        requester: wallet.publicKey,
        feePayer: feePayer.publicKey,
      })
      .rpc()

    // const { blockhash, lastValidBlockHeight } =
    //   await this.connection.getLatestBlockhash()
    // tx.recentBlockhash = blockhash
    // tx.feePayer = feePayer.publicKey

    // let hash

    // if (wallet.publicKey.equals(feePayer.publicKey)) {
    //   const signedTx = await wallet.signTransaction(tx)
    //   hash = await this.connection.sendRawTransaction(signedTx.serialize())
    // } else {
    //   await wallet.signTransaction(tx)
    //   await feePayer.signTransaction(tx)
    //   hash = await this.connection.sendRawTransaction(tx.serialize())
    // }

    // await this.connection.confirmTransaction({
    //   signature: hash,
    //   blockhash,
    //   lastValidBlockHeight,
    // })

    try {
      const pollResult = await this.pollForRequestId({
        requestId,
        payload: args.payload,
        path: args.path,
        options: options.retry,
      })

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

  async pollForRequestId({
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

    let foundSignature: RSVSignature | undefined
    let foundError: SignatureErrorData | undefined

    await withRetry(
      async () => {
        const signature = await this.getSignatureFromEvents(requestId)

        if (signature) {
          const sig = concat([
            padHex(`0x${signature.r}`, { size: 32 }),
            padHex(`0x${signature.s}`, { size: 32 }),
            `0x${signature.v.toString(16)}`,
          ])

          const requesterAddress = this.provider.publicKey.toString()
          const evm = new chainAdapters.evm.EVM({
            publicClient: createPublicClient({
              transport: http(),
            }),
            contract: this,
          })
          const { address: expectedAddress } =
            await evm.deriveAddressAndPublicKey(requesterAddress, path)

          const recoveredAddress = await recoverAddress({
            hash: new Uint8Array(payload),
            signature: sig,
          })

          if (
            recoveredAddress.toLowerCase() !== expectedAddress.toLowerCase()
          ) {
            throw new Error('Signature not found yet')
          }

          foundSignature = signature
          return signature
        }

        const error = await this.getErrorFromEvents(requestId)
        if (error) {
          foundError = error
          return error
        }

        throw new Error('Signature not found yet')
      },
      {
        delay,
        retryCount,
        shouldRetry: ({ count, error }) => {
          console.log(`Retrying get signature: ${count}/${retryCount}`)
          return error.message === 'Signature not found yet'
        },
      }
    )

    if (foundSignature) {
      return foundSignature
    }

    if (foundError) {
      return foundError
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
    const requesterAddress = this.provider.publicKey.toString()

    return generateRequestIdSolana({
      payload: args.payload,
      path: args.path,
      keyVersion: args.key_version,
      algo: options.algo || '',
      dest: options.dest || '',
      params: options.params || '',
      address: requesterAddress,
    })
  }

  async getErrorFromEvents(
    requestId: string
  ): Promise<SignatureErrorData | undefined> {
    // Create a Promise that will resolve when a matching SignatureError event is found
    return new Promise((resolve) => {
      const timeoutId = setTimeout(() => resolve(undefined), 1000) // Short timeout to avoid blocking

      const listener = this.program.addEventListener(
        'signatureErrorEvent',
        (event: any) => {
          const eventRequestIdHex =
            '0x' + Buffer.from(event.requestId).toString('hex')

          if (eventRequestIdHex === requestId) {
            clearTimeout(timeoutId)
            this.program.removeEventListener(listener)

            resolve({
              requestId: event.requestId,
              responder: event.responder,
              error: event.error,
            })
          }
        }
      )

      // Clean up listener after timeout
      setTimeout(() => {
        this.program.removeEventListener(listener)
      }, 1000)
    })
  }

  /**
   * Searches for SignatureResponded events that match the given requestId.
   *
   * @param requestId - The identifier for the signature request
   * @returns The RSV signature if found, undefined otherwise
   */
  async getSignatureFromEvents(
    requestId: string
  ): Promise<RSVSignature | undefined> {
    // Create a Promise that will resolve when a matching SignatureResponded event is found
    return new Promise((resolve) => {
      const timeoutId = setTimeout(() => resolve(undefined), 1000) // Short timeout to avoid blocking

      const listener = this.program.addEventListener(
        'signatureRespondedEvent',
        (event: any) => {
          const eventRequestIdHex =
            '0x' + Buffer.from(event.requestId).toString('hex')

          if (eventRequestIdHex === requestId) {
            clearTimeout(timeoutId)
            this.program.removeEventListener(listener)

            // Process signature data
            const signature = event.signature
            const bigRx = Buffer.from(signature.bigR.x).toString('hex')
            const s = Buffer.from(signature.s).toString('hex')
            const recoveryId = signature.recoveryId

            // Create RSV signature
            const rsvSignature: RSVSignature = {
              r: bigRx,
              s: s,
              v: recoveryId + 27, // Convert to Ethereum v value
            }

            resolve(rsvSignature)
          }
        }
      )

      // Clean up listener after timeout
      setTimeout(() => {
        this.program.removeEventListener(listener)
      }, 1000)
    })
  }
}
