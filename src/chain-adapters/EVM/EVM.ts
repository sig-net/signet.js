import {
  parseTransaction,
  type PublicClient,
  hashMessage,
  hashTypedData,
  keccak256,
  toBytes,
  type Hex,
  serializeTransaction,
  type Signature,
  numberToHex,
  getAddress,
  type Address,
  type Hash,
  concatHex,
} from 'viem'

import { ChainAdapter } from '@chain-adapters/ChainAdapter'
import type {
  EVMTransactionRequest,
  EVMUnsignedTransaction,
  EVMMessage,
  EVMTypedData,
} from '@chain-adapters/EVM/types'
import { fetchEVMFeeProperties } from '@chain-adapters/EVM/utils'
import type { BaseChainSignatureContract } from '@contracts/ChainSignatureContract'
import type { HashToSign, RSVSignature, KeyDerivationPath } from '@types'

/**
 * Implementation of the ChainAdapter interface for EVM-compatible networks.
 * Handles interactions with Ethereum Virtual Machine based blockchains like Ethereum, BSC, Polygon, etc.
 */
export class EVM extends ChainAdapter<
  EVMTransactionRequest,
  EVMUnsignedTransaction
> {
  private readonly client: PublicClient
  private readonly contract: BaseChainSignatureContract

  /**
   * Creates a new EVM chain instance
   * @param params - Configuration parameters
   * @param params.publicClient - A Viem PublicClient instance for reading from the blockchain
   * @param params.contract - Instance of the chain signature contract for MPC operations
   */
  constructor({
    publicClient,
    contract,
  }: {
    publicClient: PublicClient
    contract: BaseChainSignatureContract
  }) {
    super()

    this.contract = contract
    this.client = publicClient
  }

  private async attachGasAndNonce(
    transaction: EVMTransactionRequest
  ): Promise<EVMUnsignedTransaction> {
    const fees = await fetchEVMFeeProperties(this.client, transaction)
    const nonce = await this.client.getTransactionCount({
      address: transaction.from,
    })

    const { from: _from, ...rest } = transaction

    return {
      ...fees,
      nonce,
      chainId: Number(await this.client.getChainId()),
      type: 'eip1559',
      ...rest,
    }
  }

  private transformRSVSignature(signature: RSVSignature): Signature {
    return {
      r: `0x${signature.r}`,
      s: `0x${signature.s}`,
      yParity: signature.v - 27,
    }
  }

  private assembleSignature(signature: RSVSignature): Hex {
    const { r, s, yParity } = this.transformRSVSignature(signature)

    if (yParity === undefined) {
      throw new Error('Missing yParity')
    }

    return concatHex([r, s, numberToHex(yParity + 27, { size: 1 })])
  }

  async deriveAddressAndPublicKey(
    predecessor: string,
    path: KeyDerivationPath,
    keyVersion: number
  ): Promise<{
    address: string
    publicKey: string
  }> {
    const uncompressedPubKey = await this.contract.getDerivedPublicKey({
      path,
      predecessor,
      keyVersion,
    })

    if (!uncompressedPubKey) {
      throw new Error('Failed to get derived public key')
    }

    const publicKeyNoPrefix = uncompressedPubKey.startsWith('04')
      ? uncompressedPubKey.slice(2)
      : uncompressedPubKey

    const hash = keccak256(`0x${publicKeyNoPrefix}` as Hex)
    const address = getAddress(`0x${hash.slice(-40)}`)

    return {
      address,
      publicKey: uncompressedPubKey,
    }
  }

  async getBalance(
    address: string
  ): Promise<{ balance: bigint; decimals: number }> {
    const balance = await this.client.getBalance({
      address: address as Address,
    })
    return {
      balance,
      decimals: 18,
    }
  }

  serializeTransaction(transaction: EVMUnsignedTransaction): `0x${string}` {
    return serializeTransaction(transaction)
  }

  deserializeTransaction(serialized: `0x${string}`): EVMUnsignedTransaction {
    return parseTransaction(serialized) as EVMUnsignedTransaction
  }

  async prepareTransactionForSigning(
    transactionRequest: EVMTransactionRequest
  ): Promise<{
    transaction: EVMUnsignedTransaction
    hashesToSign: HashToSign[]
  }> {
    const transaction = await this.attachGasAndNonce(transactionRequest)

    const serializedTx = serializeTransaction(transaction)
    const txHash = toBytes(keccak256(serializedTx))

    return {
      transaction,
      hashesToSign: [Array.from(txHash)],
    }
  }

  async prepareMessageForSigning(message: EVMMessage): Promise<{
    hashToSign: HashToSign
  }> {
    return {
      hashToSign: Array.from(toBytes(hashMessage(message))),
    }
  }

  async prepareTypedDataForSigning(typedDataRequest: EVMTypedData): Promise<{
    hashToSign: HashToSign
  }> {
    return {
      hashToSign: Array.from(toBytes(hashTypedData(typedDataRequest))),
    }
  }

  finalizeTransactionSigning({
    transaction,
    rsvSignatures,
  }: {
    transaction: EVMUnsignedTransaction
    rsvSignatures: RSVSignature[]
  }): `0x02${string}` {
    const signature = this.transformRSVSignature(rsvSignatures[0])

    return serializeTransaction(transaction, signature)
  }

  finalizeMessageSigning({
    rsvSignature,
  }: {
    rsvSignature: RSVSignature
  }): Hex {
    return this.assembleSignature(rsvSignature)
  }

  finalizeTypedDataSigning({
    rsvSignature,
  }: {
    rsvSignature: RSVSignature
  }): Hex {
    return this.assembleSignature(rsvSignature)
  }

  async broadcastTx(txSerialized: `0x${string}`): Promise<Hash> {
    try {
      return await this.client.sendRawTransaction({
        serializedTransaction: txSerialized,
      })
    } catch (error) {
      console.error('Transaction broadcast failed:', error)
      throw new Error('Failed to broadcast transaction.', { cause: error })
    }
  }
}
