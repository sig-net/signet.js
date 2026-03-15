import 'dotenv/config'

import * as bitcoin from 'bitcoinjs-lib'
import { describe, it, expect, beforeAll } from 'vitest'

import { chainAdapters } from '../../../src'
import {
  NIGIRI_URL,
  createSepoliaMpcContract,
  waitForUTXOs,
} from '../../utils/test-utils'

const MPC_PATH = 'e2e-btc'
const MPC_KEY_VERSION = 1

describe('BTC E2E broadcast (regtest via Sepolia MPC)', () => {
  const { account, mpcContract } = createSepoliaMpcContract()

  const btcRpcAdapter = new chainAdapters.btc.BTCRpcAdapters.Mempool(NIGIRI_URL)

  const btc = new chainAdapters.btc.Bitcoin({
    network: 'regtest',
    contract: mpcContract,
    btcRpcAdapter,
  })

  let mpcAddress: string
  let mpcPublicKey: string

  beforeAll(async () => {
    const derived = await btc.deriveAddressAndPublicKey(
      account.address,
      MPC_PATH,
      MPC_KEY_VERSION
    )
    mpcAddress = derived.address
    mpcPublicKey = derived.publicKey

    const response = await fetch(`${NIGIRI_URL}/faucet`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ address: mpcAddress }),
    })
    if (!response.ok) {
      throw new Error(`Faucet failed: ${await response.text()}`)
    }
  })

  it('should sign via Sepolia MPC and broadcast on regtest', async () => {
    const utxos = await waitForUTXOs(mpcAddress)
    const utxo = utxos[0]

    const network = bitcoin.networks.regtest
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
          { address: mpcAddress, value: sendAmount },
          { address: mpcAddress, value: change },
        ],
        publicKey: mpcPublicKey,
      })

    expect(hashesToSign).toHaveLength(1)

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

    const txHash = await btc.broadcastTx(signedTx)

    expect(txHash).toHaveLength(64)

    let receivedUtxos: Array<{ txid: string; vout: number; value: number }> = []
    for (let i = 0; i < 15; i++) {
      const resp = await fetch(`${NIGIRI_URL}/address/${mpcAddress}/utxo`)
      if (resp.ok) {
        const utxos = (await resp.json()) as Array<{
          txid: string
          vout: number
          value: number
        }>
        if (utxos.some((u) => u.txid === txHash)) {
          receivedUtxos = utxos.filter((u) => u.txid === txHash)
          break
        }
      }
      await new Promise((r) => setTimeout(r, 1000))
    }
    const totalReceived = receivedUtxos.reduce((sum, u) => sum + u.value, 0)
    expect(totalReceived).toBe(sendAmount + change)
  }, 120_000)
})
