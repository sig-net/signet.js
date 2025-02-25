import BN from 'bn.js'
import {
  type PublicClient,
  type WalletClient,
  encodeAbiParameters,
  keccak256,
  withRetry,
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

interface ChainSignatureContractArgs {
  publicClient: PublicClient
  walletClient: WalletClient
  contractAddress: `0x${string}`
  rootPublicKey?: NajPublicKey
}

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
    options: {
      sign: {
        algo?: string
        dest?: string
        params?: string
      }
      retry: {
        delay?: number
        retryCount?: number
      }
    } = {
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

    const deposit = await this.getCurrentSignatureDeposit()

    const request = {
      payload: `0x${Buffer.from(args.payload).toString('hex')}`,
      path: args.path,
      keyVersion: args.key_version,
      algo: options.sign.algo ?? '',
      dest: options.sign.dest ?? '',
      params: options.sign.params ?? '',
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
        request.payload as `0x${string}`,
        request.path,
        Number(request.keyVersion),
        this.publicClient.chain?.id ? BigInt(this.publicClient.chain.id) : 0n,
        request.algo,
        request.dest,
        request.params,
      ]
    )

    const requestId = keccak256(encoded)

    const hash = await this.walletClient.writeContract({
      address: this.contractAddress,
      abi,
      chain: this.publicClient.chain,
      account: this.walletClient.account,
      functionName: 'sign',
      args: [request],
      value: BigInt(deposit.toString()),
    })

    const receipt = await this.publicClient.waitForTransactionReceipt({ hash })

    const result = await withRetry(
      async () => {
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
            args: {
              signature: {
                bigR: { x: bigint; y: bigint }
                s: bigint
                recoveryId: number
              }
            }
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

        throw new Error('Signature not found yet')
      },
      {
        delay: options.retry.delay,
        retryCount: options.retry.retryCount,
        shouldRetry: ({ error }) => {
          return error.message === 'Signature not found yet'
        },
      }
    )

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
        args: {
          requestId: string
          responder: string
          error: string
        }
      }

      console.error('Signature error for our request:', {
        requestId: errorData.requestId,
        responder: errorData.responder,
        error: errorData.error,
      })

      throw new Error(`Signature error: ${errorData.error || 'Unknown error'}`)
    }

    return result
  }
}
