import 'dotenv/config'

import * as bitcoin from 'bitcoinjs-lib'
import {
  createPublicClient,
  createWalletClient,
  http,
} from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { sepolia } from 'viem/chains'
import { describe, it, expect, beforeAll } from 'vitest'

import { chainAdapters, constants, contracts } from '../../../src'
import { BTCRpcAdapters } from '../../../src/chain-adapters/Bitcoin/BTCRpcAdapter'

const SEPOLIA_RPC_URL =
  process.env.SEPOLIA_RPC_URL ??
  `https://sepolia.infura.io/v3/${process.env.INFURA_API_KEY ?? ''}`
const SEPOLIA_PRIVATE_KEY = process.env.SEPOLIA_PRIVATE_KEY ?? ''
const NIGIRI_URL = process.env.NIGIRI_URL ?? 'http://localhost:3000'
const MPC_PATH = 'e2e-btc'
const MPC_KEY_VERSION = 1

async function waitForUTXOs(
  address: string,
  maxRetries = 15
): Promise<Array<{ txid: string; vout: number; value: number }>> {
  for (let i = 0; i < maxRetries; i++) {
    const response = await fetch(`${NIGIRI_URL}/address/${address}/utxo`)
    if (response.ok) {
      const utxos = (await response.json()) as Array<{
        txid: string
        vout: number
        value: number
      }>
      if (utxos.length > 0) return utxos
    }
    await new Promise((resolve) => setTimeout(resolve, 1000))
  }
  throw new Error(`No UTXOs found for ${address} after ${maxRetries} retries`)
}

describe('BTC E2E broadcast (regtest via Sepolia MPC)', () => {
  const account = privateKeyToAccount(SEPOLIA_PRIVATE_KEY as `0x${string}`)

  const publicClient = createPublicClient({
    chain: sepolia,
    transport: http(SEPOLIA_RPC_URL),
  })

  const walletClient = createWalletClient({
    account,
    chain: sepolia,
    transport: http(SEPOLIA_RPC_URL),
  })

  const mpcContract = new contracts.evm.ChainSignatureContract({
    publicClient,
    walletClient,
    contractAddress: constants.CONTRACT_ADDRESSES.ETHEREUM
      .TESTNET as `0x${string}`,
  })

  const btcRpcAdapter = new BTCRpcAdapters.Mempool(NIGIRI_URL)

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

    expect(txHash).toBeDefined()
    expect(txHash).toHaveLength(64)
  }, 120_000)
})
