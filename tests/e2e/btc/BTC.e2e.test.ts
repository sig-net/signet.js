import 'dotenv/config'

import { secp256k1 } from '@noble/curves/secp256k1.js'
import * as bitcoin from 'bitcoinjs-lib'
import { describe, it, expect, beforeAll } from 'vitest'

import { chainAdapters } from '../../../src'
import {
  NIGIRI_URL,
  DEST_PRIVATE_KEY,
  createSepoliaMpcContract,
  waitForUTXOs,
} from '../../utils/test-utils'

const MPC_PATH = 'e2e-btc'
const MPC_KEY_VERSION = 1

describe('BTC E2E broadcast (regtest via Sepolia MPC)', () => {
  const { account, mpcContract } = createSepoliaMpcContract()

  const network = bitcoin.networks.regtest
  const destPubKey = Buffer.from(
    secp256k1.getPublicKey(Buffer.from(DEST_PRIVATE_KEY, 'hex'), true)
  )
  const destAddress = bitcoin.payments.p2wpkh({
    pubkey: destPubKey,
    network,
  }).address!

  const btcRpcAdapter = new chainAdapters.btc.BTCRpcAdapters.Mempool(NIGIRI_URL)

  const btc = new chainAdapters.btc.Bitcoin({
    network: 'regtest',
    contract: mpcContract,
    btcRpcAdapter,
  })

  let mpcDerivedAddress: string
  let mpcPublicKey: string

  beforeAll(async () => {
    const derived = await btc.deriveAddressAndPublicKey(
      account.address,
      MPC_PATH,
      MPC_KEY_VERSION
    )
    mpcDerivedAddress = derived.address
    mpcPublicKey = derived.publicKey

    const response = await fetch(`${NIGIRI_URL}/faucet`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ address: mpcDerivedAddress }),
    })
    if (!response.ok) {
      throw new Error(`Faucet failed: ${await response.text()}`)
    }
  })

  it('should sign via Sepolia MPC and broadcast on regtest', async () => {
    const utxos = await waitForUTXOs(mpcDerivedAddress)
    const utxo = utxos[0]

    const scriptPubKey = bitcoin.payments.p2wpkh({
      pubkey: Buffer.from(mpcPublicKey, 'hex'),
      network,
    }).output!

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
          { address: mpcDerivedAddress, value: change },
        ],
        publicKey: mpcPublicKey,
      })

    const rsvSignatures = []
    for (const hash of hashesToSign) {
      const sig = await mpcContract.sign(
        { payload: hash, path: MPC_PATH, key_version: MPC_KEY_VERSION },
        { sign: {}, retry: { delay: 5_000, retryCount: 12 } }
      )
      rsvSignatures.push(sig)
    }

    const signedTx = btc.finalizeTransactionSigning({
      transaction,
      rsvSignatures,
    })

    await btc.broadcastTx(signedTx)

    const destUtxos = await waitForUTXOs(destAddress)
    expect(destUtxos.some((u) => u.value === sendAmount)).toBe(true)
  }, 120_000)
})
