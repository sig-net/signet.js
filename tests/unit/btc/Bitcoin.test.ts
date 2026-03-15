import { secp256k1 } from '@noble/curves/secp256k1.js'
import * as bitcoin from 'bitcoinjs-lib'
import { describe, expect, it, beforeAll } from 'vitest'

import { chainAdapters } from '../../../src'
import {
  NIGIRI_URL,
  TEST_PRIVATE_KEY,
  DEST_PRIVATE_KEY,
  mockSign,
  createDummyContract,
  waitForUTXOs,
} from '../../utils/test-utils'

describe('Bitcoin', () => {
  const privKeyBytes = Buffer.from(TEST_PRIVATE_KEY, 'hex')

  const compressedPubKey = Buffer.from(
    secp256k1.getPublicKey(privKeyBytes, true)
  )
  const compressedPubKeyHex = compressedPubKey.toString('hex')

  const network = bitcoin.networks.regtest
  const payment = bitcoin.payments.p2wpkh({
    pubkey: compressedPubKey,
    network,
  })
  const address = payment.address!
  const scriptPubKey = payment.output!

  const destPubKey = Buffer.from(
    secp256k1.getPublicKey(Buffer.from(DEST_PRIVATE_KEY, 'hex'), true)
  )
  const destAddress = bitcoin.payments.p2wpkh({
    pubkey: destPubKey,
    network,
  }).address!

  const contract = createDummyContract()

  const btcRpcAdapter = new chainAdapters.btc.BTCRpcAdapters.Mempool(NIGIRI_URL)

  const btc = new chainAdapters.btc.Bitcoin({
    network: 'regtest',
    contract,
    btcRpcAdapter,
  })

  beforeAll(async () => {
    const response = await fetch(`${NIGIRI_URL}/faucet`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ address }),
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

    const rsvSignatures = hashesToSign.map((hash) =>
      mockSign(hash, privKeyBytes)
    )

    const signedTx = btc.finalizeTransactionSigning({
      transaction,
      rsvSignatures,
    })

    const txHash = await btc.broadcastTx(signedTx)

    expect(txHash).toHaveLength(64)

    const destUtxos = await waitForUTXOs(destAddress)
    expect(destUtxos.some((u) => u.value === sendAmount)).toBe(true)
  }, 30_000)

  it('should sign and broadcast a multi-input transaction', async () => {
    // Fund the address a second time to get multiple UTXOs
    await fetch(`${NIGIRI_URL}/faucet`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ address }),
    })

    // Wait until we have at least 2 UTXOs (from beforeAll + this faucet call)
    let utxos: Array<{ txid: string; vout: number; value: number }> = []
    for (let i = 0; i < 15; i++) {
      utxos = await waitForUTXOs(address)
      if (utxos.length >= 2) break
      await new Promise((r) => setTimeout(r, 1000))
    }
    expect(utxos.length).toBeGreaterThanOrEqual(2)

    const [utxo1, utxo2] = utxos
    const totalInput = utxo1.value + utxo2.value
    const sendAmount = 100_000
    const fee = 1_500
    const change = totalInput - sendAmount - fee

    const { hashesToSign, transaction } =
      await btc.prepareTransactionForSigning({
        inputs: [
          { txid: utxo1.txid, vout: utxo1.vout, value: utxo1.value, scriptPubKey },
          { txid: utxo2.txid, vout: utxo2.vout, value: utxo2.value, scriptPubKey },
        ],
        outputs: [
          { address: destAddress, value: sendAmount },
          { address, value: change },
        ],
        publicKey: compressedPubKeyHex,
      })

    expect(hashesToSign).toHaveLength(2)

    const rsvSignatures = hashesToSign.map((hash) =>
      mockSign(hash, privKeyBytes)
    )

    const signedTx = btc.finalizeTransactionSigning({
      transaction,
      rsvSignatures,
    })

    await btc.broadcastTx(signedTx)

    const destUtxos = await waitForUTXOs(destAddress)
    expect(destUtxos.some((u) => u.value === sendAmount)).toBe(true)
  }, 30_000)

  it('should reject broadcast of invalid transaction hex', async () => {
    await expect(btc.broadcastTx('deadbeef')).rejects.toThrow(
      'Failed to broadcast transaction'
    )
  })
})
