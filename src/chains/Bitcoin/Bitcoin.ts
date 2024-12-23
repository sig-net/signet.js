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
import { type Adapter } from './adapters/Adapter'
import { Mempool } from './adapters/Mempool'

export class Bitcoin
  implements Chain<BTCTransactionRequest, BTCUnsignedTransaction>
{
  private static readonly SATOSHIS_PER_BTC = 100_000_000

  private readonly network: BTCNetworkIds
  private readonly contract: ChainSignatureContract
  private readonly adapter: Adapter

  constructor(config: {
    network: BTCNetworkIds
    providerUrl: string
    contract: ChainSignatureContract
    adapter?: Adapter
  }) {
    this.network = config.network
    this.contract = config.contract
    this.adapter = config.adapter || new Mempool(config.providerUrl)
  }

  static toBTC(satoshis: number): number {
    return satoshis / Bitcoin.SATOSHIS_PER_BTC
  }

  static toSatoshi(btc: number): number {
    return Math.round(btc * Bitcoin.SATOSHIS_PER_BTC)
  }

  private async fetchTransaction(
    transactionId: string
  ): Promise<bitcoin.Transaction> {
    const data = await this.adapter.getTransaction(transactionId)
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

  async createPSBT({
    transactionRequest,
  }: {
    transactionRequest: BTCTransactionRequest
  }): Promise<bitcoin.Psbt> {
    const { inputs, outputs } =
      transactionRequest.inputs && transactionRequest.outputs
        ? transactionRequest
        : await this.adapter.getInputsAndOutputs(transactionRequest.from, [
            {
              address: transactionRequest.to,
              value: parseFloat(transactionRequest.value),
            },
          ])

    const psbt = new bitcoin.Psbt({ network: parseBTCNetwork(this.network) })

    // Since the sender address is always P2WPKH, we can assume all inputs are P2WPKH
    await Promise.all(
      inputs.map(async (utxo: BTCInput) => {
        const transaction = await this.fetchTransaction(utxo.txid)
        const prevOut = transaction.outs[utxo.vout]
        const value = utxo.value

        // Prepare the input as P2WPKH
        const inputOptions = {
          hash: utxo.txid,
          index: utxo.vout,
          witnessUtxo: {
            script: prevOut.script,
            value,
          },
        }

        psbt.addInput(inputOptions)
      })
    )

    outputs.forEach((out: BTCOutput) => {
      psbt.addOutput({
        address: out.address,
        value: out.value,
      })
    })

    return psbt
  }

  async getBalance(address: string): Promise<string> {
    const balance = await this.adapter.getBalance(address)
    return Bitcoin.toBTC(balance).toString()
  }

  async deriveAddressAndPublicKey(
    signerId: string,
    path: KeyDerivationPath
  ): Promise<{ address: string; publicKey: string }> {
    const uncompressedPubKey = await this.contract.getDerivedPublicKey({
      path,
      predecessor: signerId,
    })

    if (!uncompressedPubKey) {
      throw new Error('Failed to get derived public key')
    }

    const derivedKey = compressPubKey(uncompressedPubKey)
    const publicKeyBuffer = Buffer.from(derivedKey, 'hex')
    const network = parseBTCNetwork(this.network)

    // Use P2WPKH (Bech32) address type
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

  async broadcast(transactionSerialized: string): Promise<string> {
    return await this.adapter.broadcastTransaction(transactionSerialized)
  }
}
