import { secp256k1 } from '@noble/curves/secp256k1.js'
import { createPublicClient, createWalletClient, http } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { sepolia } from 'viem/chains'

import { constants, contracts } from '../../src'
import type { RSVSignature } from '../../src'

export const HARDHAT_RPC_URL = 'http://127.0.0.1:8545'
export const NIGIRI_URL = 'http://localhost:3000'
export const COSMOS_RPC_URL = 'http://localhost:26657'
export const COSMOS_REST_URL = 'http://localhost:1317'

export const TEST_PRIVATE_KEY =
  '1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef'

export const DEST_PRIVATE_KEY =
  'abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890'

export function mockSign(
  payload: number[],
  privKeyBytes: Uint8Array
): RSVSignature {
  const sigBytes = secp256k1.sign(new Uint8Array(payload), privKeyBytes, {
    prehash: false,
    format: 'recovered',
  })
  const sig = secp256k1.Signature.fromBytes(sigBytes, 'recovered')
  if (sig.recovery === undefined) throw new Error('Missing recovery bit')
  return {
    r: sig.r.toString(16).padStart(64, '0'),
    s: sig.s.toString(16).padStart(64, '0'),
    v: sig.recovery + 27,
  }
}

const SEPOLIA_RPC_URL = process.env.SEPOLIA_RPC_URL ?? ''
const SEPOLIA_PRIVATE_KEY = process.env.SEPOLIA_PRIVATE_KEY ?? ''

export function createSepoliaMpcContract() {
  const account = privateKeyToAccount(
    SEPOLIA_PRIVATE_KEY as `0x${string}`
  )

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

  return { account, mpcContract }
}

// Placeholder contract that satisfies the ChainSignatureContract interface but is
// never actually called. Unit tests mock signing locally via mockSign(), so no
// contract interaction occurs. If an adapter ever tried to call sign() or
// getDerivedPublicKey() on this, it would fail with a connection error — that's
// intentional, as it would surface an unexpected dependency on the contract.
export function createDummyContract() {
  return new contracts.evm.ChainSignatureContract({
    publicClient: createPublicClient({ transport: http('http://localhost') }),
    walletClient: createWalletClient({ transport: http('http://localhost') }),
    contractAddress: constants.CONTRACT_ADDRESSES.ETHEREUM
      .TESTNET as `0x${string}`,
  })
}

export async function waitForUTXOs(
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
