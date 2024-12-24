import { GasPrice, StargateClient, calculateFee } from '@cosmjs/stargate'
import {
  Registry,
  makeSignBytes,
  encodePubkey,
  makeAuthInfoBytes,
  makeSignDoc,
  type TxBodyEncodeObject,
} from '@cosmjs/proto-signing'
import { toBase64, fromBase64, fromHex } from '@cosmjs/encoding'
import { encodeSecp256k1Pubkey } from '@cosmjs/amino'
import { TxRaw } from 'cosmjs-types/cosmos/tx/v1beta1/tx'
import { ripemd160, sha256 } from '@cosmjs/crypto'

import { type ChainInfo, fetchChainInfo } from './utils'
import { type MPCPayloads } from '../types'
import {
  type BalanceResponse,
  type CosmosNetworkIds,
  type CosmosTransactionRequest,
  type CosmosUnsignedTransaction,
} from './types'
import {
  type RSVSignature,
  type KeyDerivationPath,
} from '../../signature/types'
import { type Chain } from '../Chain'
import { bech32 } from 'bech32'
import { SignMode } from 'cosmjs-types/cosmos/tx/signing/v1beta1/signing'
import { type ChainSignatureContract } from '../ChainSignatureContract'
import { compressPubKey } from '../../utils/key'

/**
 * Implementation of the Chain interface for Cosmos-based networks.
 * Handles interactions with Cosmos SDK chains like Cosmos Hub, Osmosis, etc.
 */
export class Cosmos
  implements Chain<CosmosTransactionRequest, CosmosUnsignedTransaction>
{
  private readonly registry: Registry
  private readonly chainId: CosmosNetworkIds
  private readonly contract: ChainSignatureContract
  private readonly endpoints?: {
    rpcUrl?: string
    restUrl?: string
  }

  /**
   * Creates a new Cosmos chain instance
   * @param params - Configuration parameters
   * @param params.chainId - Chain identifier for the Cosmos network
   * @param params.contract - Instance of the chain signature contract for MPC operations
   * @param params.endpoints - Optional RPC and REST endpoints
   * @param params.endpoints.rpcUrl - Optional RPC endpoint URL
   * @param params.endpoints.restUrl - Optional REST endpoint URL
   */
  constructor({
    chainId,
    contract,
    endpoints,
  }: {
    contract: ChainSignatureContract
    chainId: CosmosNetworkIds
    endpoints?: {
      rpcUrl?: string
      restUrl?: string
    }
  }) {
    this.registry = new Registry()
    this.chainId = chainId
    this.contract = contract
    this.endpoints = endpoints
  }

  private parseRSVSignature(rsvSignature: RSVSignature): Uint8Array {
    return new Uint8Array([
      ...fromHex(rsvSignature.r),
      ...fromHex(rsvSignature.s),
    ])
  }

  private async getChainInfo(): Promise<ChainInfo> {
    return {
      ...(await fetchChainInfo(this.chainId)),
      ...this.endpoints,
    }
  }

  /**
   * Gets the balance of a Cosmos address in the chain's native token
   * @param address - The Cosmos address to check
   * @returns The balance formatted according to the chain's decimals
   * @throws Error if balance fetch fails
   */
  async getBalance(address: string): Promise<string> {
    try {
      const { restUrl, denom, decimals } = await this.getChainInfo()

      const response = await fetch(
        `${restUrl}/cosmos/bank/v1beta1/balances/${address}`
      )

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const data = (await response.json()) as BalanceResponse
      const balance = data.balances.find((b) => b.denom === denom)
      const amount = balance?.amount ?? '0'

      const formattedBalance = (
        parseInt(amount) / Math.pow(10, decimals)
      ).toString()
      return formattedBalance
    } catch (error) {
      console.error('Failed to fetch Cosmos balance:', error)
      throw new Error('Failed to fetch Cosmos balance')
    }
  }

  /**
   * Derives a Cosmos address and public key from a signer ID and derivation path
   * @param predecessor - The ID of the signer to derive from
   * @param path - The derivation path to use
   * @returns Object containing the derived Cosmos address and public key
   * @throws Error if public key derivation fails
   */
  async deriveAddressAndPublicKey(
    predecessor: string,
    path: KeyDerivationPath
  ): Promise<{
    address: string
    publicKey: string
  }> {
    const { prefix } = await this.getChainInfo()
    const uncompressedPubKey = await this.contract.getDerivedPublicKey({
      path,
      predecessor,
    })

    if (!uncompressedPubKey) {
      throw new Error('Failed to get derived public key')
    }

    const derivedKey = compressPubKey(uncompressedPubKey)
    const pubKeySha256 = sha256(Buffer.from(fromHex(derivedKey)))
    const ripemd160Hash = ripemd160(pubKeySha256)
    const address = bech32.encode(prefix, bech32.toWords(ripemd160Hash))

    return { address, publicKey: derivedKey }
  }

  /**
   * Stores an unsigned transaction in local storage
   * @param transaction - The unsigned transaction to store
   * @param storageKey - The key to store the transaction under
   */
  setTransaction(
    transaction: CosmosUnsignedTransaction,
    storageKey: string
  ): void {
    const serialized = TxRaw.encode(transaction).finish()
    window.localStorage.setItem(storageKey, toBase64(serialized))
  }

  /**
   * Retrieves a stored transaction from local storage
   * @param storageKey - The key of the stored transaction
   * @param options - Optional parameters
   * @param options.remove - Whether to remove the transaction after retrieval
   * @returns The stored transaction or undefined if not found
   */
  getTransaction(
    storageKey: string,
    options?: {
      remove?: boolean
    }
  ): CosmosUnsignedTransaction | undefined {
    const serialized = window.localStorage.getItem(storageKey)
    if (!serialized) return undefined

    if (options?.remove) {
      window.localStorage.removeItem(storageKey)
    }

    return TxRaw.decode(fromBase64(serialized))
  }

  /**
   * Prepares a transaction for MPC signing by creating the necessary payloads
   * @param transactionRequest - The transaction request containing messages and options
   * @returns Object containing the unsigned transaction and MPC payloads
   * @throws Error if account does not exist on chain
   */
  async getMPCPayloadAndTransaction(
    transactionRequest: CosmosTransactionRequest
  ): Promise<{
    transaction: CosmosUnsignedTransaction
    mpcPayloads: MPCPayloads
  }> {
    const { denom, rpcUrl, gasPrice } = await this.getChainInfo()
    const publicKeyBytes = fromHex(transactionRequest.publicKey)

    const gasLimit = transactionRequest.gas || 200_000

    const fee = calculateFee(
      gasLimit,
      GasPrice.fromString(`${gasPrice}${denom}`)
    )

    const client = await StargateClient.connect(rpcUrl)
    const accountOnChain = await client.getAccount(transactionRequest.address)
    if (!accountOnChain) {
      throw new Error(
        `Account ${transactionRequest.address} does not exist on chain`
      )
    }

    const { accountNumber, sequence } = accountOnChain

    const txBodyEncodeObject: TxBodyEncodeObject = {
      typeUrl: '/cosmos.tx.v1beta1.TxBody',
      value: {
        messages: transactionRequest.messages,
        memo: transactionRequest.memo || '',
      },
    }

    const txBodyBytes = this.registry.encode(txBodyEncodeObject)

    const pubkey = encodePubkey(encodeSecp256k1Pubkey(publicKeyBytes))

    // TODO: Allow caller to provide: multiple signers, fee payer, fee granter
    const authInfoBytes = makeAuthInfoBytes(
      [
        {
          pubkey,
          sequence,
        },
      ],
      fee.amount,
      Number(fee.gas),
      undefined,
      undefined,
      SignMode.SIGN_MODE_DIRECT
    )

    const signDoc = makeSignDoc(
      txBodyBytes,
      authInfoBytes,
      this.chainId,
      accountNumber
    )

    const signBytes = makeSignBytes(signDoc)
    const payload = Array.from(sha256(signBytes))

    return {
      transaction: TxRaw.fromPartial({
        bodyBytes: txBodyBytes,
        authInfoBytes,
        signatures: [],
      }),
      mpcPayloads: [
        {
          index: 0,
          payload,
        },
      ],
    }
  }

  /**
   * Adds signatures to a Cosmos transaction
   * @param params - Parameters for adding signatures
   * @param params.transaction - The unsigned transaction
   * @param params.mpcSignatures - Array of RSV signatures from MPC
   * @returns The serialized signed transaction in hex format
   */
  addSignature({
    transaction,
    mpcSignatures,
  }: {
    transaction: CosmosUnsignedTransaction
    mpcSignatures: RSVSignature[]
  }): string {
    // Allow support for multi-sig but the package only supports single-sig
    transaction.signatures = mpcSignatures.map((sig) =>
      this.parseRSVSignature(sig)
    )

    const txBytes = TxRaw.encode(transaction).finish()
    return Buffer.from(txBytes).toString('hex')
  }

  /**
   * Broadcasts a signed transaction to the network
   * @param txSerialized - The serialized signed transaction in hex format
   * @returns The transaction hash
   * @throws Error if broadcast fails
   */
  async broadcastTx(txSerialized: string): Promise<string> {
    try {
      const { rpcUrl } = await this.getChainInfo()
      const client = await StargateClient.connect(rpcUrl)

      const txBytes = Buffer.from(txSerialized, 'hex')
      const broadcastResponse = await client.broadcastTx(txBytes)

      if (broadcastResponse.code !== 0) {
        throw new Error(`Broadcast error: ${broadcastResponse.rawLog}`)
      }

      return broadcastResponse.transactionHash
    } catch (error) {
      console.error('Transaction broadcast failed:', error)
      throw new Error('Failed to broadcast transaction.')
    }
  }
}
