import BN from 'bn.js'
import {
  type PublicClient,
  type WalletClient,
  decodeEventLog,
  encodeAbiParameters,
  keccak256,
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

  async sign(args: SignArgs): Promise<RSVSignature> {
    if (!this.walletClient?.account) {
      throw new Error('Wallet client required for signing operations')
    }

    const deposit = await this.getCurrentSignatureDeposit()

    // Updated sign request according to the new ABI
    const request = {
      payload: `0x${Buffer.from(args.payload).toString('hex')}`,
      path: args.path,
      keyVersion: args.key_version,
      algo: '',
      dest: '',
      params: '',
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

    console.log({ encoded: keccak256(encoded) })

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

    // Decode all relevant events from the receipt
    for (const log of receipt.logs) {
      if (log.address.toLowerCase() !== this.contractAddress.toLowerCase()) {
        continue
      }

      try {
        const decodedLog = decodeEventLog({
          abi,
          data: log.data,
          topics: log.topics,
          strict: false,
        }) as {
          eventName: string
          args: {
            signature?: {
              bigR: { x: bigint; y: bigint }
              s: bigint
              recoveryId: number
            }
            sender?: string
            payload?: string
            keyVersion?: number
            deposit?: bigint
            chainId?: bigint
            path?: string
            algo?: string
            dest?: string
            params?: string
            requestId?: string
            responder?: string
            error?: string
          }
        }

        console.log('Decoded event:', {
          name: decodedLog.eventName,
          args: decodedLog.args,
        })

        // Handle SignatureResponded event
        if (
          decodedLog.eventName === 'SignatureResponded' &&
          decodedLog.args.signature
        ) {
          return cryptography.toRSV({
            big_r:
              decodedLog.args.signature.bigR.x.toString() +
              decodedLog.args.signature.bigR.y.toString(),
            s: decodedLog.args.signature.s.toString(),
            recovery_id: decodedLog.args.signature.recoveryId,
          })
        }

        // Handle SignatureRequested event
        if (decodedLog.eventName === 'SignatureRequested') {
          console.log('Signature request details:', {
            sender: decodedLog.args.sender,
            payload: decodedLog.args.payload,
            keyVersion: decodedLog.args.keyVersion,
            deposit: decodedLog.args.deposit,
            chainId: decodedLog.args.chainId,
            path: decodedLog.args.path,
            algo: decodedLog.args.algo,
            dest: decodedLog.args.dest,
            params: decodedLog.args.params,
          })
        }

        // Handle SignatureError event
        if (
          decodedLog.eventName === 'SignatureError' &&
          decodedLog.args.error
        ) {
          console.error('Signature error:', {
            requestId: decodedLog.args.requestId,
            responder: decodedLog.args.responder,
            error: decodedLog.args.error,
          })
          throw new Error(`Signature error: ${decodedLog.args.error}`)
        }
      } catch (err) {
        console.warn('Failed to decode log:', err)
      }
    }

    throw new Error('No SignatureResponded event found in transaction receipt')
  }
}
