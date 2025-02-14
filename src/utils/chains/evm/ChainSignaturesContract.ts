import BN from 'bn.js'
import {
  type PublicClient,
  type WalletClient,
  decodeEventLog,
  keccak256,
  toBytes,
} from 'viem'

import { ChainSignatureContract as AbstractChainSignatureContract } from '@chains/ChainSignatureContract'
import type { SignArgs } from '@chains/ChainSignatureContract'
import type {
  MPCSignature,
  RSVSignature,
  UncompressedPubKeySEC1,
} from '@chains/types'
import { cryptography } from '@utils'

import { abi } from './ChainSignaturesContractABI'

interface ChainSignatureContractArgs {
  publicClient: PublicClient
  walletClient: WalletClient
  contractAddress: `0x${string}`
}

export class ChainSignatureContract extends AbstractChainSignatureContract {
  private readonly publicClient: PublicClient
  private readonly walletClient?: WalletClient
  private readonly contractAddress: `0x${string}`

  constructor(args: ChainSignatureContractArgs) {
    super()
    this.publicClient = args.publicClient
    this.walletClient = args.walletClient
    this.contractAddress = args.contractAddress
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
    const pubKey = (await this.publicClient.readContract({
      address: this.contractAddress,
      abi,
      functionName: 'derivedPublicKey',
      args: [args.path, args.predecessor as `0x${string}`],
    })) as { x: bigint; y: bigint }

    return `04${pubKey.x.toString(16).padStart(64, '0')}${pubKey.y.toString(16).padStart(64, '0')}`
  }

  async getPublicKey(): Promise<UncompressedPubKeySEC1> {
    const pubKey = (await this.publicClient.readContract({
      address: this.contractAddress,
      abi,
      functionName: 'getPublicKey',
    })) as { x: bigint; y: bigint }

    return `04${pubKey.x.toString(16).padStart(64, '0')}${pubKey.y.toString(16).padStart(64, '0')}`
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

    const [address] = await this.walletClient.getAddresses()
    const deposit = await this.getCurrentSignatureDeposit()

    const derivedKey = await this.getDerivedPublicKey({
      path: args.path,
      predecessor: address,
    })

    const request = {
      payload: `0x${Buffer.from(args.payload).toString('hex')}`,
      path: args.path,
      keyVersion: args.key_version,
      derivedPublicKey: {
        x: BigInt(`0x${derivedKey.slice(2, 66)}`),
        y: BigInt(`0x${derivedKey.slice(66)}`),
      },
    }

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

    const signatureEvent = receipt.logs.find(
      (log) =>
        log.address.toLowerCase() === this.contractAddress.toLowerCase() &&
        log.topics[0] ===
          keccak256(
            toBytes(
              'SignatureResponded(bytes32,((uint256,uint256),uint256,uint8))'
            )
          )
    ) // SignatureResponded topic

    if (!signatureEvent) {
      throw new Error('Signature event not found in transaction receipt')
    }

    console.log(signatureEvent)

    const signature = decodeEventLog({
      abi,
      data: signatureEvent.data,
      topics: signatureEvent.topics,
      strict: false, // Allow partial decoding
    }) as unknown as { response: MPCSignature }

    console.log(signature)

    return cryptography.toRSV(signature.response)
  }
}
