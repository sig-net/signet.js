import { najToUncompressedPubKeySEC1 } from '@utils/cryptography'
import { getRootPublicKey } from '@utils/publicKey'
import BN from 'bn.js'
import { withRetry, type PublicClient, type WalletClient, type Hex } from 'viem'

import { CHAINS, KDF_CHAIN_IDS } from '@constants'
import { ChainSignatureContract as AbstractChainSignatureContract } from '@contracts/ChainSignatureContract'
import type { SignArgs } from '@contracts/ChainSignatureContract'
import type {
  NajPublicKey,
  RSVSignature,
  SigNetEvmMpcSignature,
  UncompressedPubKeySEC1,
} from '@types'
import { cryptography } from '@utils'

import { abi } from './ChainSignaturesContractABI'
import {
  SignatureNotFoundError,
  SignatureContractError,
  SigningError,
} from './errors'
import type {
  RequestIdArgs,
  SignOptions,
  SignRequest,
  SignatureErrorData,
} from './types'
import { getRequestId } from './utils'

/**
 * Implementation of the ChainSignatureContract for EVM chains.
 *
 * When signing data, the contract emits a SignatureRequested event with a requestId.
 * This requestId is used to track the signature request and retrieve the signature
 * once it's available. The sign method handles this process automatically by polling
 * for the signature using the requestId.
 */
export class ChainSignatureContract extends AbstractChainSignatureContract {
  private readonly publicClient: PublicClient
  private readonly walletClient: WalletClient
  private readonly contractAddress: Hex
  private readonly rootPublicKey: NajPublicKey

  /**
   * Creates a new instance of the ChainSignatureContract for EVM chains.
   *
   * @param args - Configuration options for the contract
   * @param args.publicClient - A Viem PublicClient instance for reading from the blockchain
   * @param args.walletClient - A Viem WalletClient instance for sending transactions
   * @param args.contractAddress - The address of the deployed ChainSignatures contract (e.g. `0x857ED3A242B59cC24144814a0DF41C397a3811E6`)
   * @param args.rootPublicKey - Optional root public key. If not provided, it will be derived from the contract address
   */
  constructor(args: {
    publicClient: PublicClient
    walletClient: WalletClient
    contractAddress: Hex
    rootPublicKey?: NajPublicKey
  }) {
    super()
    this.publicClient = args.publicClient
    this.walletClient = args.walletClient
    this.contractAddress = args.contractAddress

    const rootPublicKey =
      args.rootPublicKey ||
      getRootPublicKey(this.contractAddress, CHAINS.ETHEREUM)

    if (!rootPublicKey) {
      throw new Error(
        `Invalid public key, please provide a valid root public key or contract address`
      )
    }

    this.rootPublicKey = rootPublicKey
  }

  async getCurrentSignatureDeposit(): Promise<BN> {
    const deposit = (await this.publicClient.readContract({
      address: this.contractAddress,
      abi,
      functionName: 'getSignatureDeposit',
    })) as bigint

    return new BN(deposit.toString())
  }

  async getDerivedPublicKey(args: {
    path: string
    predecessor: string
  }): Promise<UncompressedPubKeySEC1> {
    const pubKey = cryptography.deriveChildPublicKey(
      await this.getPublicKey(),
      args.predecessor.toLowerCase(),
      args.path,
      KDF_CHAIN_IDS.ETHEREUM
    )

    return pubKey
  }

  async getPublicKey(): Promise<UncompressedPubKeySEC1> {
    return najToUncompressedPubKeySEC1(this.rootPublicKey)
  }

  async getLatestKeyVersion(): Promise<number> {
    const version = (await this.publicClient.readContract({
      address: this.contractAddress,
      abi,
      functionName: 'latestKeyVersion',
    })) as bigint

    return Number(version)
  }

  /**
   * Sends a sign request transaction and return the transaction hash.
   *
   * @param args - The signature arguments
   * @param options - The signing options
   * @returns The transaction hash
   */
  async createSignatureRequest(
    args: SignArgs,
    options: Pick<SignOptions, 'sign'> = {
      sign: {
        algo: '',
        dest: '',
        params: '',
      },
    }
  ): Promise<{
    txHash: Hex
    requestId: Hex
  }> {
    if (!this.walletClient?.account) {
      throw new Error('Wallet client required for signing operations')
    }

    const request: SignRequest = {
      payload: `0x${Buffer.from(args.payload).toString('hex')}`,
      path: args.path,
      keyVersion: args.key_version,
      algo: options.sign.algo ?? '',
      dest: options.sign.dest ?? '',
      params: options.sign.params ?? '',
    }

    const requestId = this.getRequestId({
      ...request,
      address: this.walletClient.account.address,
      chainId: this.publicClient.chain?.id
        ? BigInt(this.publicClient.chain.id)
        : 0n,
    })

    const hash = await this.walletClient.writeContract({
      address: this.contractAddress,
      abi,
      chain: this.publicClient.chain,
      account: this.walletClient.account,
      functionName: 'sign',
      args: [request],
      value: BigInt((await this.getCurrentSignatureDeposit()).toString()),
    })

    return {
      txHash: hash,
      requestId,
    }
  }

  /**
   * Sends a transaction to the contract to request a signature, then
   * polls for the signature result. If the signature is not found within the retry
   * parameters, it will throw an error.
   */
  async sign(
    args: SignArgs,
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
    const { txHash, requestId } = await this.createSignatureRequest(
      args,
      options
    )

    const receipt = await this.publicClient.waitForTransactionReceipt({
      hash: txHash,
    })

    try {
      const result = await withRetry(
        async () => {
          const result = await this.getSignatureFromEvents(
            requestId,
            receipt.blockNumber
          )

          // TODO: Validate if this is the signature corresponding to the transaction as anybody can call respond on the contract

          if (result) {
            return result
          } else {
            throw new Error('Signature not found yet')
          }
        },
        {
          delay: options.retry.delay,
          retryCount: options.retry.retryCount,
          shouldRetry: ({ count, error }) => {
            // TODO: Should be enabled only on debug mode
            console.log(
              `Retrying get signature: ${count}/${options.retry.retryCount}`
            )
            return error.message === 'Signature not found yet'
          },
        }
      )

      if (result) {
        return result
      } else {
        const errorData = await this.getErrorFromEvents(
          requestId,
          receipt.blockNumber
        )
        if (errorData) {
          throw new SignatureContractError(errorData.error, requestId, receipt)
        } else {
          throw new SignatureNotFoundError(requestId, receipt)
        }
      }
    } catch (error) {
      if (
        error instanceof SignatureNotFoundError ||
        error instanceof SignatureContractError
      ) {
        throw error
      } else {
        throw new SigningError(
          requestId,
          receipt,
          error instanceof Error ? error : undefined
        )
      }
    }
  }

  /**
   * Generates the request ID for a signature request allowing to track the response.
   *
   * @param request - The signature request object containing:
   *   @param request.address - The contract/wallet address calling the signing contract
   *   @param request.payload - The data payload to be signed as a hex string
   *   @param request.path - The derivation path for the key
   *   @param request.keyVersion - The version of the key to use
   *   @param request.chainId - The chain ID as a bigint
   *   @param request.algo - The signing algorithm to use
   *   @param request.dest - The destination for the signature
   *   @param request.params - Additional parameters for the signing process
   * @returns A hex string representing the unique request ID
   *
   * @example
   * ```typescript
   * const requestId = ChainSignatureContract.getRequestId({
   *   address: walletClient.account.address,
   *   payload: payload: `0x${Buffer.from(args.payload).toString('hex')}`,,
   *   path: '',
   *   keyVersion: 0,
   *   chainId: 1n,
   *   algo: '',
   *   dest: '',
   *   params: ''
   * });
   * console.log(requestId); // 0x...
   * ```
   */
  getRequestId(request: RequestIdArgs): Hex {
    return getRequestId(request)
  }

  async getErrorFromEvents(
    requestId: Hex,
    fromBlock: bigint
  ): Promise<SignatureErrorData | undefined> {
    const errorLogs = await this.publicClient.getContractEvents({
      address: this.contractAddress,
      abi,
      eventName: 'SignatureError',
      args: {
        requestId,
      },
      fromBlock,
      toBlock: 'latest',
    })

    if (errorLogs.length > 0) {
      const { args: errorData } = errorLogs[
        errorLogs.length - 1
      ] as unknown as {
        args: SignatureErrorData
      }

      return errorData
    }

    return undefined
  }

  /**
   * Searches for SignatureResponded events that match the given requestId.
   * It works in conjunction with the getRequestId method which generates the unique
   * identifier for a signature request.
   *
   * @param requestId - The identifier for the signature request
   * @param fromBlock - The block number to start searching from
   * @returns The RSV signature if found, undefined otherwise
   */
  async getSignatureFromEvents(
    requestId: Hex,
    fromBlock: bigint
  ): Promise<RSVSignature | undefined> {
    const logs = await this.publicClient.getContractEvents({
      address: this.contractAddress,
      abi,
      eventName: 'SignatureResponded',
      args: {
        requestId,
      },
      fromBlock,
      toBlock: 'latest',
    })

    if (logs.length > 0) {
      const { args: signatureData } = logs[logs.length - 1] as unknown as {
        args: {
          signature: SigNetEvmMpcSignature
        }
      }

      return cryptography.toRSV(signatureData.signature)
    }

    return undefined
  }
}
