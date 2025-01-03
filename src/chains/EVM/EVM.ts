import { ethers, keccak256 } from 'ethers'
import { fetchEVMFeeProperties } from './utils'
import { type MPCPayloads } from '../types'
import {
  type EVMTransactionRequest,
  type EVMUnsignedTransaction,
} from './types'
import {
  type RSVSignature,
  type KeyDerivationPath,
} from '../../signature/types'
import { type Chain } from '../Chain'
import { type ChainSignatureContract } from '../ChainSignatureContract'
import { fromHex } from '@cosmjs/encoding'

/**
 * Implementation of the Chain interface for EVM-compatible networks.
 * Handles interactions with Ethereum Virtual Machine based blockchains like Ethereum, BSC, Polygon, etc.
 */
export class EVM
  implements Chain<EVMTransactionRequest, EVMUnsignedTransaction>
{
  private readonly provider: ethers.JsonRpcProvider
  private readonly contract: ChainSignatureContract

  /**
   * Creates a new EVM chain instance
   * @param config - Configuration object for the EVM chain
   * @param config.rpcUrl - URL of the EVM JSON-RPC provider (e.g., Infura endpoint)
   * @param config.contract - Instance of the chain signature contract for MPC operations
   */
  constructor(config: { rpcUrl: string; contract: ChainSignatureContract }) {
    this.provider = new ethers.JsonRpcProvider(config.rpcUrl)
    this.contract = config.contract
  }

  private async attachGasAndNonce(
    transaction: EVMTransactionRequest
  ): Promise<EVMUnsignedTransaction> {
    const fees = await fetchEVMFeeProperties(
      this.provider._getConnection().url,
      transaction
    )
    const nonce = await this.provider.getTransactionCount(
      transaction.from,
      'latest'
    )

    const { from, ...rest } = transaction

    return {
      ...fees,
      chainId: this.provider._network.chainId,
      nonce,
      type: 2,
      ...rest,
    }
  }

  private parseSignature(signature: RSVSignature): ethers.SignatureLike {
    return ethers.Signature.from({
      r: `0x${signature.r}`,
      s: `0x${signature.s}`,
      v: signature.v,
    })
  }

  async deriveAddressAndPublicKey(
    predecessor: string,
    path: KeyDerivationPath
  ): Promise<{
    address: string
    publicKey: string
  }> {
    const uncompressedPubKey = await this.contract.getDerivedPublicKey({
      path,
      predecessor,
    })

    if (!uncompressedPubKey) {
      throw new Error('Failed to get derived public key')
    }

    const publicKeyNoPrefix = uncompressedPubKey.startsWith('04')
      ? uncompressedPubKey.substring(2)
      : uncompressedPubKey

    const hash = ethers.keccak256(fromHex(publicKeyNoPrefix))

    return {
      address: `0x${hash.substring(hash.length - 40)}`,
      publicKey: uncompressedPubKey,
    }
  }

  async getBalance(address: string): Promise<string> {
    try {
      const balance = await this.provider.getBalance(address)
      return ethers.formatEther(balance)
    } catch (error) {
      console.error(`Failed to fetch balance for address ${address}:`, error)
      throw new Error('Failed to fetch balance.')
    }
  }

  setTransaction(
    transaction: EVMUnsignedTransaction,
    storageKey: string
  ): void {
    const serializedTransaction = JSON.stringify(transaction, (_, value) =>
      typeof value === 'bigint' ? value.toString() : value
    )
    window.localStorage.setItem(storageKey, serializedTransaction)
  }

  getTransaction(
    storageKey: string,
    options?: {
      remove?: boolean
    }
  ): EVMUnsignedTransaction | undefined {
    const txSerialized = window.localStorage.getItem(storageKey)
    if (options?.remove) {
      window.localStorage.removeItem(storageKey)
    }
    return txSerialized ? JSON.parse(txSerialized) : undefined
  }

  async getMPCPayloadAndTransaction(
    transactionRequest: EVMTransactionRequest
  ): Promise<{
    transaction: EVMUnsignedTransaction
    mpcPayloads: MPCPayloads
  }> {
    const transaction = await this.attachGasAndNonce(transactionRequest)
    const txSerialized = ethers.Transaction.from(transaction).unsignedSerialized
    const transactionHash = keccak256(txSerialized)
    const txHash = Array.from(ethers.getBytes(transactionHash))

    return {
      transaction,
      mpcPayloads: [
        {
          index: 0,
          payload: txHash,
        },
      ],
    }
  }

  addSignature({
    transaction,
    mpcSignatures,
  }: {
    transaction: EVMUnsignedTransaction
    mpcSignatures: RSVSignature[]
  }): string {
    return ethers.Transaction.from({
      ...transaction,
      signature: this.parseSignature(mpcSignatures[0]),
    }).serialized
  }

  async broadcastTx(txSerialized: string): Promise<string> {
    try {
      const txResponse = await this.provider.broadcastTransaction(txSerialized)
      return txResponse.hash
    } catch (error) {
      console.error('Transaction broadcast failed:', error)
      throw new Error('Failed to broadcast transaction.')
    }
  }
}
