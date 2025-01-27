import { fromHex } from '@cosmjs/encoding'
import {
  createPublicClient,
  http,
  type PublicClient,
  hashMessage,
  hashTypedData,
  keccak256,
  toBytes,
  type Hex,
  serializeTransaction,
  type TransactionSerializable,
  type TypedDataDefinition,
  type Signature,
  toHex,
  numberToHex,
  getAddress,
  type Address,
  type Hash,
  concatHex,
  encodePacked,
} from 'viem'

import { Chain } from '@chains/Chain'
import type { BaseChainSignatureContract } from '@chains/ChainSignatureContract'
import type {
  EVMTransactionRequest,
  EVMUnsignedTransaction,
  EVMMessage,
  EVMTypedData,
  EVMUserOperation,
} from '@chains/EVM/types'
import { fetchEVMFeeProperties } from '@chains/EVM/utils'
import type {
  MPCPayloads,
  RSVSignature,
  KeyDerivationPath,
} from '@chains/types'

/**
 * Implementation of the Chain interface for EVM-compatible networks.
 * Handles interactions with Ethereum Virtual Machine based blockchains like Ethereum, BSC, Polygon, etc.
 */
export class EVM extends Chain<EVMTransactionRequest, EVMUnsignedTransaction> {
  private readonly client: PublicClient
  private readonly contract: BaseChainSignatureContract
  private readonly rpcUrl: string

  /**
   * Creates a new EVM chain instance
   * @param params - Configuration parameters
   * @param params.rpcUrl - URL of the EVM JSON-RPC provider (e.g., Infura endpoint)
   * @param params.contract - Instance of the chain signature contract for MPC operations
   */
  constructor({
    rpcUrl,
    contract,
  }: {
    rpcUrl: string
    contract: BaseChainSignatureContract
  }) {
    super()

    this.contract = contract
    this.rpcUrl = rpcUrl
    this.client = createPublicClient({
      transport: http(rpcUrl),
    })
  }

  private async attachGasAndNonce(
    transaction: EVMTransactionRequest
  ): Promise<EVMUnsignedTransaction> {
    const fees = await fetchEVMFeeProperties(this.rpcUrl, transaction)
    const nonce = await this.client.getTransactionCount({
      address: transaction.from,
    })

    const { from, ...rest } = transaction

    return {
      ...fees,
      ...rest,
      chainId: Number(await this.client.getChainId()),
      nonce,
      type: 'eip1559',
    }
  }

  private parseSignature(signature: RSVSignature): Signature {
    return {
      r: signature.r.startsWith('0x')
        ? (signature.r as `0x${string}`)
        : `0x${signature.r}`,
      s: signature.s.startsWith('0x')
        ? (signature.s as `0x${string}`)
        : `0x${signature.s}`,
      v: BigInt(signature.v),
      yParity: signature.v % 2,
    }
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

    const publicKeyNoPrefix: string = uncompressedPubKey.startsWith('04')
      ? uncompressedPubKey.substring(2)
      : uncompressedPubKey

    const publicKeyBytes = toBytes(toHex(fromHex(publicKeyNoPrefix)))
    const hash = keccak256(publicKeyBytes)
    const address = getAddress(hash.slice(-40))

    return {
      address,
      publicKey: uncompressedPubKey,
    }
  }

  async getBalance(address: string): Promise<string> {
    const balance = await this.client.getBalance({
      address: address as Address,
    })
    return (balance / BigInt(10 ** 18)).toString()
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
    const serializedTx = serializeTransaction(
      transaction as TransactionSerializable
    )
    const txHash = toBytes(keccak256(serializedTx))

    return {
      transaction,
      mpcPayloads: [Array.from(txHash)],
    }
  }

  async getMPCPayloadAndMessage(messageRequest: EVMMessage): Promise<{
    message: string
    mpcPayloads: MPCPayloads
  }> {
    const messageHash = hashMessage(messageRequest.message)
    const messageBytes = toBytes(messageHash)

    return {
      message: messageRequest.message,
      mpcPayloads: [Array.from(messageBytes)],
    }
  }

  async getMPCPayloadAndTypedData(typedDataRequest: EVMTypedData): Promise<{
    typedData: EVMTypedData
    mpcPayloads: MPCPayloads
  }> {
    const { from, ...typedData } = typedDataRequest
    const typedDataHash = hashTypedData(typedData as TypedDataDefinition)
    const typedDataBytes = toBytes(typedDataHash)

    return {
      typedData: typedDataRequest,
      mpcPayloads: [Array.from(typedDataBytes)],
    }
  }

  async getMPCPayloadAndUserOp(userOp: EVMUserOperation): Promise<{
    userOp: EVMUserOperation
    mpcPayloads: MPCPayloads
  }> {
    const chainId = await this.client.getChainId()
    const entryPoint = '0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789' as Address
    const userOpHash = keccak256(
      encodePacked(
        ['address', 'uint256', 'bytes32'],
        [
          entryPoint,
          BigInt(chainId),
          keccak256(
            encodePacked(
              [
                'address',
                'uint256',
                'bytes',
                'bytes',
                'uint256',
                'uint256',
                'uint256',
                'uint256',
                'uint256',
                'bytes',
              ],
              [
                userOp.sender,
                userOp.nonce,
                userOp.initCode,
                userOp.callData,
                userOp.callGasLimit,
                userOp.verificationGasLimit,
                userOp.preVerificationGas,
                userOp.maxFeePerGas,
                userOp.maxPriorityFeePerGas,
                userOp.paymasterAndData,
              ]
            )
          ),
        ]
      )
    )
    const userOpBytes = toBytes(userOpHash)

    return {
      userOp,
      mpcPayloads: [Array.from(userOpBytes)],
    }
  }

  addSignature({
    transaction,
    mpcSignatures,
  }: {
    transaction: EVMUnsignedTransaction
    mpcSignatures: RSVSignature[]
  }): string {
    const { r, s, v } = this.parseSignature(mpcSignatures[0])
    if (v === undefined || v === null)
      throw new Error('Invalid signature: missing v value')
    const signedTx: TransactionSerializable = {
      ...transaction,
      r: r.startsWith('0x') ? r : (`0x${r}` as `0x${string}`),
      s: s.startsWith('0x') ? s : (`0x${s}` as `0x${string}`),
      // v: BigInt(v),
      yParity: Number(v % BigInt(2)),
      // accessList: [],
    }
    return serializeTransaction(signedTx)
  }

  addMessageSignature({
    mpcSignatures,
  }: {
    message: string
    mpcSignatures: RSVSignature[]
  }): Hex {
    const { r, s, v } = this.parseSignature(mpcSignatures[0])
    return concatHex([r, s, numberToHex(Number(v) + 27, { size: 1 })])
  }

  addTypedDataSignature({
    mpcSignatures,
  }: {
    typedData: EVMTypedData
    mpcSignatures: RSVSignature[]
  }): Hex {
    const { r, s, v } = this.parseSignature(mpcSignatures[0])
    return concatHex([r, s, numberToHex(Number(v) + 27, { size: 1 })])
  }

  addUserOpSignature({
    userOp,
    mpcSignatures,
  }: {
    userOp: EVMUserOperation
    mpcSignatures: RSVSignature[]
  }): EVMUserOperation {
    const { r, s, v } = this.parseSignature(mpcSignatures[0])
    return {
      ...userOp,
      signature: concatHex([r, s, numberToHex(Number(v), { size: 1 })]),
    }
  }

  async broadcastTx(txSerialized: string): Promise<Hash> {
    try {
      return await this.client.sendRawTransaction({
        serializedTransaction: txSerialized as Hex,
      })
    } catch (error) {
      console.error('Transaction broadcast failed:', error)
      throw new Error('Failed to broadcast transaction.')
    }
  }
}
