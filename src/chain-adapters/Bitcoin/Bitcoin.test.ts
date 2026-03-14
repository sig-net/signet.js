import { secp256k1 } from '@noble/curves/secp256k1'
import * as bitcoin from 'bitcoinjs-lib'
import BN from 'bn.js'
import { describe, expect, it, beforeAll } from 'vitest'

import type { BaseChainSignatureContract } from '../../contracts/ChainSignatureContract'
import type { UncompressedPubKeySEC1 } from '../../types'

import { Bitcoin } from './Bitcoin'
import { BTCRpcAdapters } from './BTCRpcAdapter'

const NIGIRI_URL = process.env.NIGIRI_URL ?? 'http://localhost:3000'

async function waitForUTXOs(
  address: string,
  maxRetries = 10
): Promise<Array<{ txid: string; vout: number; value: number }>> {
  for (let i = 0; i < maxRetries; i++) {
    const response = await fetch(`${NIGIRI_URL}/address/${address}/utxo`)
    const utxos = (await response.json()) as Array<{
      txid: string
      vout: number
      value: number
    }>
    if (utxos.length > 0) return utxos
    await new Promise((resolve) => setTimeout(resolve, 1000))
  }
  throw new Error(`No UTXOs found for ${address} after ${maxRetries} retries`)
}

describe('Bitcoin', () => {
  const privateKey =
    '1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef'
  const privKeyBytes = Buffer.from(privateKey, 'hex')

  const compressedPubKey = Buffer.from(
    secp256k1.getPublicKey(privKeyBytes, true)
  )
  const compressedPubKeyHex = compressedPubKey.toString('hex')

  const uncompressedPubKey = Buffer.from(
    secp256k1.getPublicKey(privKeyBytes, false)
  ).toString('hex') as UncompressedPubKeySEC1

  const network = bitcoin.networks.regtest
  const payment = bitcoin.payments.p2wpkh({
    pubkey: compressedPubKey,
    network,
  })
  const address = payment.address!
  const scriptPubKey = payment.output!

  const destPubKey = Buffer.from(
    secp256k1.getPublicKey(
      Buffer.from(
        'abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
        'hex'
      ),
      true
    )
  )
  const destAddress = bitcoin.payments.p2wpkh({
    pubkey: destPubKey,
    network,
  }).address!

  const contract = {
    getDerivedPublicKey: async () => uncompressedPubKey,
    getCurrentSignatureDeposit: async () => new BN(0),
  } as BaseChainSignatureContract

  const btcRpcAdapter = new BTCRpcAdapters.Mempool(NIGIRI_URL)

  const btc = new Bitcoin({
    network: 'regtest',
    contract,
    btcRpcAdapter,
  })

  const mockSign = async (payload: number[]) => {
    const { r, s, recovery } = secp256k1.sign(
      new Uint8Array(payload),
      privKeyBytes
    )
    return {
      r: r.toString(16).padStart(64, '0'),
      s: s.toString(16).padStart(64, '0'),
      v: recovery + 27,
    }
  }

  beforeAll(async () => {
    const response = await fetch(`${NIGIRI_URL}/faucet`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ address, amount: 0.001 }),
    })
    if (!response.ok) {
      throw new Error(`Faucet failed: ${await response.text()}`)
    }
  })

  it('should sign and broadcast a transaction', async () => {
    const utxos = await waitForUTXOs(address)
    const utxo = utxos[0]

    const sendAmount = 50_000
    const fee = 1_000
    const change = utxo.value - sendAmount - fee

    const { hashesToSign, transaction } =
      await btc.prepareTransactionForSigning({
        inputs: [
          {
            txid: utxo.txid,
            vout: utxo.vout,
            value: utxo.value,
            scriptPubKey,
          },
        ],
        outputs: [
          { address: destAddress, value: sendAmount },
          { address, value: change },
        ],
        publicKey: compressedPubKeyHex,
      })

    expect(hashesToSign).toHaveLength(1)
    expect(hashesToSign[0]).toHaveLength(32)

    const rsvSignatures = await Promise.all(
      hashesToSign.map((hash) => mockSign(hash))
    )

    const signedTx = btc.finalizeTransactionSigning({
      transaction,
      rsvSignatures,
    })

    const txHash = await btc.broadcastTx(signedTx)

    expect(txHash).toBeDefined()
    expect(txHash).toHaveLength(64)
  }, 30_000)
})
