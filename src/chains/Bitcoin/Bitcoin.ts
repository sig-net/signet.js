import * as bitcoin from 'bitcoinjs-lib'

import { parseBTCNetwork } from './utils'
import { type MPCPayloads } from '../types'
import {
  type BTCInput,
  type BTCNetworkIds,
  type BTCOutput,
  type BTCTransactionRequest,
  type BTCUnsignedTransaction,
} from './types'
import {
  type RSVSignature,
  type KeyDerivationPath,
} from '../../signature/types'
import { type Chain } from '../Chain'
import { type ChainSignatureContract } from '../ChainSignatureContract'
import { compressPubKey } from '../../utils/key'
import { type BTCRpcAdapter } from './adapters/BTCRpcAdapter'

/**
 * Implementation of the Chain interface for Bitcoin network.
 * Handles interactions with both Bitcoin mainnet and testnet, supporting P2WPKH transactions.
 */
export class Bitcoin
  implements Chain<BTCTransactionRequest, BTCUnsignedTransaction>
{
  private static readonly SATOSHIS_PER_BTC = 100_000_000

  private readonly network: BTCNetworkIds
  private readonly contract: ChainSignatureContract
  private readonly btcRpcAdapter: BTCRpcAdapter

  /**
   * Creates a new Bitcoin chain instance
   * @param config - Configuration object for the Bitcoin chain
   * @param config.network - Network identifier (mainnet/testnet)
   * @param config.contract - Instance of the chain signature contract for MPC operations
   * @param config.btcRpcAdapter - Bitcoin RPC adapter for network interactions
   */
  constructor(config: {
    network: BTCNetworkIds
    contract: ChainSignatureContract
    btcRpcAdapter: BTCRpcAdapter
  }) {
    this.network = config.network
    this.contract = config.contract
    this.btcRpcAdapter = config.btcRpcAdapter
  }

  /**
   * Converts satoshis to BTC
   * @param satoshis - Amount in satoshis
   * @returns Amount in BTC
   */
  static toBTC(satoshis: number): number {
    return satoshis / Bitcoin.SATOSHIS_PER_BTC
  }

  /**
   * Converts BTC to satoshis
   * @param btc - Amount in BTC
   * @returns Amount in satoshis (rounded)
   */
  static toSatoshi(btc: number): number {
    return Math.round(btc * Bitcoin.SATOSHIS_PER_BTC)
  }

  private async fetchTransaction(
    transactionId: string
  ): Promise<bitcoin.Transaction> {
    const data = await this.btcRpcAdapter.getTransaction(transactionId)
    const tx = new bitcoin.Transaction()

    data.vout.forEach((vout) => {
      const scriptPubKey = Buffer.from(vout.scriptpubkey, 'hex')
      tx.addOutput(scriptPubKey, vout.value)
    })

    return tx
  }

  private static parseRSVSignature(signature: RSVSignature): Buffer {
    const r = signature.r.padStart(64, '0')
    const s = signature.s.padStart(64, '0')

    const rawSignature = Buffer.from(r + s, 'hex')

    if (rawSignature.length !== 64) {
      throw new Error('Invalid signature length.')
    }

    return rawSignature
  }

  /**
   * Creates a Partially Signed Bitcoin Transaction (PSBT)
   * @param params - Parameters for creating the PSBT
   * @param params.transactionRequest - Transaction request containing inputs and outputs
   * @returns Created PSBT instance
   */
  async createPSBT({
    transactionRequest,
  }: {
    transactionRequest: BTCTransactionRequest
  }): Promise<bitcoin.Psbt> {
    const { inputs, outputs } =
      transactionRequest.inputs && transactionRequest.outputs
        ? transactionRequest
        : await this.btcRpcAdapter.selectUTXOs(transactionRequest.from, [
            {
              address: transactionRequest.to,
              value: parseFloat(transactionRequest.value),
            },
          ])

    const psbt = new bitcoin.Psbt({ network: parseBTCNetwork(this.network) })

    await Promise.all(
      inputs.map(async (utxo: BTCInput) => {
        if (!utxo.scriptPubKey) {
          const transaction = await this.fetchTransaction(utxo.txid)
          const prevOut = transaction.outs[utxo.vout]
          utxo.scriptPubKey = prevOut.script
        }

        // Prepare the input as P2WPKH
        const inputOptions = {
          hash: utxo.txid,
          index: utxo.vout,
          witnessUtxo: {
            script: utxo.scriptPubKey,
            value: utxo.value,
          },
        }

        psbt.addInput(inputOptions)
      })
    )

    outputs.forEach((out: BTCOutput) => {
      if (out.address) {
        psbt.addOutput({
          address: out.address,
          value: out.value,
        })
      } else if (out.script) {
        psbt.addOutput({
          script: out.script,
          value: out.value,
        })
      }
    })

    return psbt
  }

  /**
   * Gets the BTC balance of an address
   * @param address - The Bitcoin address to check
   * @returns The balance in BTC as a string
   */
  async getBalance(address: string): Promise<string> {
    const balance = await this.btcRpcAdapter.getBalance(address)
    return Bitcoin.toBTC(balance).toString()
  }

  /**
   * Derives a Bitcoin address and public key from a signer ID and derivation path
   * @param predecessor - The ID of the signer to derive from
   * @param path - The derivation path to use
   * @returns Object containing the derived Bitcoin address and public key
   * @throws Error if public key derivation or address generation fails
   */
  async deriveAddressAndPublicKey(
    predecessor: string,
    path: KeyDerivationPath
  ): Promise<{ address: string; publicKey: string }> {
    const uncompressedPubKey = await this.contract.getDerivedPublicKey({
      path,
      predecessor,
    })

    if (!uncompressedPubKey) {
      throw new Error('Failed to get derived public key')
    }

    const derivedKey = compressPubKey(uncompressedPubKey)
    const publicKeyBuffer = Buffer.from(derivedKey, 'hex')
    const network = parseBTCNetwork(this.network)

    const payment = bitcoin.payments.p2wpkh({
      pubkey: publicKeyBuffer,
      network,
    })

    const { address } = payment

    if (!address) {
      throw new Error('Failed to generate Bitcoin address')
    }

    return { address, publicKey: derivedKey }
  }

  /**
   * Stores an unsigned transaction in local storage
   * @param transaction - The unsigned transaction to store
   * @param storageKey - The key to store the transaction under
   */
  setTransaction(
    transaction: BTCUnsignedTransaction,
    storageKey: string
  ): void {
    window.localStorage.setItem(
      storageKey,
      JSON.stringify({
        psbt: transaction.psbt.toHex(),
        publicKey: transaction.publicKey,
      })
    )
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
  ): BTCUnsignedTransaction | undefined {
    const txSerialized = window.localStorage.getItem(storageKey)
    if (!txSerialized) return undefined

    if (options?.remove) {
      window.localStorage.removeItem(storageKey)
    }

    const transactionJSON = JSON.parse(txSerialized)
    return {
      psbt: bitcoin.Psbt.fromHex(transactionJSON.psbt as string),
      publicKey: transactionJSON.publicKey,
    }
  }

  /**
   * Prepares a transaction for MPC signing by creating the necessary payloads
   * @param transactionRequest - The transaction request to prepare
   * @returns Object containing the unsigned transaction and MPC payloads
   */
  async getMPCPayloadAndTransaction(
    transactionRequest: BTCTransactionRequest
  ): Promise<{
    transaction: BTCUnsignedTransaction
    mpcPayloads: MPCPayloads
  }> {
    const publicKeyBuffer = Buffer.from(transactionRequest.publicKey, 'hex')
    const psbt = await this.createPSBT({
      transactionRequest,
    })

    // We can't double sign a PSBT, therefore we serialize the payload before to return it
    const psbtHex = psbt.toHex()

    const mpcPayloads: MPCPayloads = []

    const mockKeyPair = (index: number): bitcoin.Signer => ({
      publicKey: publicKeyBuffer,
      sign: (hash: Buffer): Buffer => {
        mpcPayloads.push({
          index,
          payload: Array.from(hash),
        })
        // Return dummy signature to satisfy the interface
        return Buffer.alloc(64)
      },
    })

    for (let index = 0; index < psbt.inputCount; index++) {
      psbt.signInput(index, mockKeyPair(index))
    }

    return {
      transaction: {
        psbt: bitcoin.Psbt.fromHex(psbtHex),
        publicKey: transactionRequest.publicKey,
      },
      mpcPayloads: mpcPayloads.sort((a, b) => a.index - b.index),
    }
  }

  /**
   * Adds signatures to a PSBT
   * @param params - Parameters for adding signatures
   * @param params.transaction - The unsigned transaction with PSBT
   * @param params.mpcSignatures - Array of RSV signatures from MPC
   * @returns The serialized signed transaction
   * @throws Error if signature application fails
   */
  addSignature({
    transaction: { psbt, publicKey },
    mpcSignatures,
  }: {
    transaction: BTCUnsignedTransaction
    mpcSignatures: RSVSignature[]
  }): string {
    const publicKeyBuffer = Buffer.from(publicKey, 'hex')

    const keyPair = (index: number): bitcoin.Signer => ({
      publicKey: publicKeyBuffer,
      sign: () => {
        const mpcSignature = mpcSignatures[index]
        return Bitcoin.parseRSVSignature(mpcSignature)
      },
    })

    for (let index = 0; index < psbt.inputCount; index++) {
      psbt.signInput(index, keyPair(index))
    }

    psbt.finalizeAllInputs()
    return psbt.extractTransaction().toHex()
  }

  /**
   * Broadcasts a signed transaction to the Bitcoin network
   * @param txSerialized - The serialized transaction in hex format
   * @returns The transaction ID (txid) of the broadcast transaction
   * @throws Error if broadcasting fails
   */
  async broadcastTx(txSerialized: string): Promise<string> {
    return await this.btcRpcAdapter.broadcastTransaction(txSerialized)
  }
}
