import BN from 'bn.js'
import {
  encodeAbiParameters,
  keccak256,
  type TransactionReceipt,
  withRetry,
  type PublicClient,
  type WalletClient,
} from 'viem'

import { ChainSignatureContract as AbstractChainSignatureContract } from '@chains/ChainSignatureContract'
import type { SignArgs } from '@chains/ChainSignatureContract'
import type {
  NajPublicKey,
  RSVSignature,
  UncompressedPubKeySEC1,
} from '@chains/types'
import { cryptography } from '@utils'
import { ROOT_PUBLIC_SIG_NET_TESTNET } from '@utils/constants'
import { najToUncompressedPubKeySEC1 } from '@utils/cryptography'

import { abi } from './ChainSignaturesContractABI'
import {
  SignatureNotFoundError,
  SignatureContractError,
  SigningError,
} from './errors'
import type {
  ChainSignatureContractArgs,
  SignOptions,
  SignRequest,
  SignatureData,
  SignatureErrorData,
} from './types'

export class ChainSignatureContract extends AbstractChainSignatureContract {
  private readonly publicClient: PublicClient
  private readonly walletClient?: WalletClient
  private readonly contractAddress: `0x${string}`
  private readonly rootPublicKey: NajPublicKey

  constructor(args: ChainSignatureContractArgs) {
    super()
    this.publicClient = args.publicClient
    this.walletClient = args.walletClient
    this.contractAddress = args.contractAddress

    if (args.rootPublicKey) {
      this.rootPublicKey = args.rootPublicKey
    } else if (this.publicClient.chain?.testnet) {
      this.rootPublicKey = ROOT_PUBLIC_SIG_NET_TESTNET
    } else {
      throw new Error('EVM main net is not supported yet')
    }
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
      args.predecessor,
      args.path
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

    const requestId = this.getRequestId(request)

    const hash = await this.walletClient.writeContract({
      address: this.contractAddress,
      abi,
      chain: this.publicClient.chain,
      account: this.walletClient.account,
      functionName: 'sign',
      args: [request],
      value: BigInt((await this.getCurrentSignatureDeposit()).toString()),
    })

    const receipt = await this.publicClient.waitForTransactionReceipt({ hash })

    try {
      const result = await withRetry(
        async () => {
          const result = await this.getSignatureFromEvents(requestId, receipt)
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
        const errorData = await this.getErrorFromEvents(requestId, receipt)
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

  private getRequestId(request: SignRequest): `0x${string}` {
    if (!this.walletClient?.account) {
      throw new Error('Wallet client required for signing operations')
    }

    const encoded = encodeAbiParameters(
      [
        { type: 'address' },
        { type: 'bytes' },
        { type: 'string' },
        { type: 'uint32' },
        { type: 'uint256' },
        { type: 'string' },
        { type: 'string' },
        { type: 'string' },
      ],
      [
        this.walletClient.account.address,
        request.payload,
        request.path,
        Number(request.keyVersion),
        this.publicClient.chain?.id ? BigInt(this.publicClient.chain.id) : 0n,
        request.algo,
        request.dest,
        request.params,
      ]
    )

    return keccak256(encoded)
  }

  async getErrorFromEvents(
    requestId: `0x${string}`,
    receipt: TransactionReceipt
  ): Promise<SignatureErrorData | undefined> {
    const errorLogs = await this.publicClient.getContractEvents({
      address: this.contractAddress,
      abi,
      eventName: 'SignatureError',
      args: {
        requestId,
      },
      fromBlock: receipt.blockNumber,
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

  async getSignatureFromEvents(
    requestId: `0x${string}`,
    receipt: TransactionReceipt
  ): Promise<RSVSignature | undefined> {
    const logs = await this.publicClient.getContractEvents({
      address: this.contractAddress,
      abi,
      eventName: 'SignatureResponded',
      args: {
        requestId,
      },
      fromBlock: receipt.blockNumber,
      toBlock: 'latest',
    })

    if (logs.length > 0) {
      const { args: signatureData } = logs[logs.length - 1] as unknown as {
        args: SignatureData
      }

      if (signatureData.signature) {
        const { bigR, s, recoveryId } = signatureData.signature

        return cryptography.toRSV({
          big_r: bigR.x.toString() + bigR.y.toString(),
          s: s.toString(),
          recovery_id: recoveryId,
        })
      }
    }

    return undefined
  }
}
