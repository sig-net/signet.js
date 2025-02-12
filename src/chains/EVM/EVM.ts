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
  type TypedDataDefinition,
  type Signature,
  numberToHex,
  getAddress,
  type Address,
  type Hash,
  concatHex,
  encodeAbiParameters,
  hexToBigInt,
  concat,
  pad,
  isAddress,
} from 'viem'

import { Chain } from '@chains/Chain'
import type { BaseChainSignatureContract } from '@chains/ChainSignatureContract'
import type {
  EVMTransactionRequest,
  EVMUnsignedTransaction,
  EVMMessage,
  EVMTypedData,
  UserOperationV6,
  UserOperationV7,
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
    const fees = await fetchEVMFeeProperties(this.client, transaction)
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
      r: `0x${signature.r}`,
      s: `0x${signature.s}`,
      yParity: signature.v - 27,
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

    const publicKeyNoPrefix = uncompressedPubKey.startsWith('04')
      ? uncompressedPubKey.slice(2)
      : uncompressedPubKey

    const hash = keccak256(Buffer.from(publicKeyNoPrefix, 'hex'))
    const address = getAddress(`0x${hash.slice(-40)}`)

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

    const serializedTx = serializeTransaction(transaction)
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

  /**
   * This implementation is a common step for Biconomy and Alchemy.
   * Key differences between implementations:
   * - Signature format: Biconomy omits 0x00 prefix when concatenating, Alchemy includes it
   * - Version support: Biconomy only supports v6, Alchemy supports both v6 and v7
   * - Validation: Biconomy uses modules for signature validation, Alchemy uses built-in validation
   */
  async getMPCPayloadAndUserOp(
    userOp: UserOperationV7 | UserOperationV6,
    entryPointAddress?: Address,
    chainIdArgs?: number
  ): Promise<{
    userOp: UserOperationV7 | UserOperationV6
    mpcPayloads: MPCPayloads
  }> {
    const chainId = chainIdArgs ?? (await this.client.getChainId())
    const entryPoint =
      entryPointAddress || '0x0000000071727De22E5E9d8BAf0edAc6f37da032'

    const encoded = encodeAbiParameters(
      [{ type: 'bytes32' }, { type: 'address' }, { type: 'uint256' }],
      [
        keccak256(
          encodeAbiParameters(
            [
              { type: 'address' },
              { type: 'uint256' },
              { type: 'bytes32' },
              { type: 'bytes32' },
              { type: 'bytes32' },
              { type: 'uint256' },
              { type: 'bytes32' },
              { type: 'bytes32' },
            ],
            [
              userOp.sender,
              hexToBigInt(userOp.nonce),
              keccak256(
                'factory' in userOp &&
                  'factoryData' in userOp &&
                  userOp.factory &&
                  userOp.factoryData
                  ? concat([userOp.factory, userOp.factoryData])
                  : 'initCode' in userOp
                    ? userOp.initCode
                    : '0x'
              ),
              keccak256(userOp.callData),
              concat([
                pad(userOp.verificationGasLimit, { size: 16 }),
                pad(userOp.callGasLimit, { size: 16 }),
              ]),
              hexToBigInt(userOp.preVerificationGas),
              concat([
                pad(userOp.maxPriorityFeePerGas, { size: 16 }),
                pad(userOp.maxFeePerGas, { size: 16 }),
              ]),
              keccak256(
                'paymaster' in userOp &&
                  userOp.paymaster &&
                  isAddress(userOp.paymaster)
                  ? concat([
                      userOp.paymaster,
                      pad(userOp.paymasterVerificationGasLimit, { size: 16 }),
                      pad(userOp.paymasterPostOpGasLimit, { size: 16 }),
                      userOp.paymasterData,
                    ])
                  : 'paymasterAndData' in userOp
                    ? userOp.paymasterAndData
                    : '0x'
              ),
            ]
          )
        ),
        entryPoint,
        BigInt(chainId),
      ]
    )

    const userOpHash = keccak256(encoded)

    return {
      userOp,
      mpcPayloads: [Array.from(toBytes(hashMessage({ raw: userOpHash })))],
    }
  }

  addSignature({
    transaction,
    mpcSignatures,
  }: {
    transaction: EVMUnsignedTransaction
    mpcSignatures: RSVSignature[]
  }): `0x02${string}` {
    const signature = this.parseSignature(mpcSignatures[0])

    return serializeTransaction(transaction, signature)
  }

  addMessageSignature({
    mpcSignatures,
  }: {
    message: string
    mpcSignatures: RSVSignature[]
  }): Hex {
    const { r, s, yParity } = this.parseSignature(mpcSignatures[0])
    if (yParity === undefined) {
      throw new Error('Missing yParity')
    }

    return concatHex([r, s, numberToHex(Number(yParity + 27), { size: 1 })])
  }

  addTypedDataSignature({
    mpcSignatures,
  }: {
    typedData: EVMTypedData
    mpcSignatures: RSVSignature[]
  }): Hex {
    const { r, s, yParity } = this.parseSignature(mpcSignatures[0])
    if (yParity === undefined) {
      throw new Error('Missing yParity')
    }

    return concatHex([r, s, numberToHex(Number(yParity + 27), { size: 1 })])
  }

  addUserOpSignature({
    userOp,
    mpcSignatures,
  }: {
    userOp: UserOperationV7 | UserOperationV6
    mpcSignatures: RSVSignature[]
  }): UserOperationV7 | UserOperationV6 {
    const { r, s, yParity } = this.parseSignature(mpcSignatures[0])
    if (yParity === undefined) {
      throw new Error('Missing yParity')
    }

    return {
      ...userOp,
      signature: concatHex([
        '0x00', // Alchemy specific implementation. Biconomy doesn't include the 0x00 prefix.
        r,
        s,
        numberToHex(Number(yParity + 27), { size: 1 }),
      ]),
    }
  }

  async broadcastTx(txSerialized: `0x${string}`): Promise<Hash> {
    try {
      return await this.client.sendRawTransaction({
        serializedTransaction: txSerialized,
      })
    } catch (error) {
      console.error('Transaction broadcast failed:', error)
      throw new Error('Failed to broadcast transaction.')
    }
  }
}
