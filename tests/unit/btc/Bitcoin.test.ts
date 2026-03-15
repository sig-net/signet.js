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
})
