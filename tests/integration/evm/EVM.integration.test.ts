import 'dotenv/config'
import { randomBytes } from 'node:crypto'

import {
  createPublicClient,
  createWalletClient,
  http,
  recoverPublicKey,
  type Hex,
} from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { sepolia } from 'viem/chains'
import { describe, it, expect } from 'vitest'

import { chainAdapters, constants, contracts } from '../../../src'

const SEPOLIA_RPC_URL =
  process.env.SEPOLIA_RPC_URL ??
  `https://sepolia.infura.io/v3/${process.env.INFURA_API_KEY ?? ''}`
const SEPOLIA_PRIVATE_KEY = process.env.SEPOLIA_PRIVATE_KEY ?? ''

describe('EVM ChainSignatures integration (Sepolia)', () => {
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

  const contract = new contracts.evm.ChainSignatureContract({
    publicClient,
    walletClient,
    contractAddress: constants.CONTRACT_ADDRESSES.ETHEREUM
      .TESTNET as `0x${string}`,
  })

  const signAndRecover = async (path: string) => {
    const payload = Array.from(randomBytes(32))
    const keyVersion = 1

    const rsv = await contract.sign(
      { payload, path, key_version: keyVersion },
      { sign: {}, retry: { delay: 5_000, retryCount: 12 } }
    )

    const recoveredPubKey = await recoverPublicKey({
      hash: new Uint8Array(payload),
      signature: {
        r: `0x${rsv.r}` as Hex,
        s: `0x${rsv.s}` as Hex,
        yParity: rsv.v - 27,
      },
    })

    // Strip 0x prefix to get uncompressed SEC1 format (04...)
    return recoveredPubKey.slice(2)
  }

  it('EVM: sign on Sepolia and verify derived address matches', async () => {
    const path = `evm-${Date.now()}`
    const evm = new chainAdapters.evm.EVM({ publicClient, contract })

    const { publicKey: derivedPubKey } =
      await evm.deriveAddressAndPublicKey(account.address, path, 1)

    const recoveredPubKey = await signAndRecover(path)

    expect(recoveredPubKey).toBe(derivedPubKey)
  }, 120_000)

  it('BTC: sign on Sepolia and verify derived public key matches', async () => {
    const path = `btc-${Date.now()}`
    const btc = new chainAdapters.btc.Bitcoin({
      contract,
      network: 'testnet',
    })

    const { publicKey: derivedPubKey } =
      await btc.deriveAddressAndPublicKey(account.address, path, 1)

    const recoveredPubKey = await signAndRecover(path)

    // BTC returns compressed key (02/03 + x), recovery returns uncompressed (04 + x + y)
    // Compare x-coordinates (chars 2..66)
    expect(recoveredPubKey.slice(2, 66)).toBe(derivedPubKey.slice(2, 66))
  }, 120_000)

  it('Cosmos: sign on Sepolia and verify derived public key matches', async () => {
    const path = `cosmos-${Date.now()}`
    const cosmos = new chainAdapters.cosmos.Cosmos({
      contract,
      chainId: 'cosmoshub-4',
    })

    const { publicKey: derivedPubKey } =
      await cosmos.deriveAddressAndPublicKey(account.address, path, 1)

    const recoveredPubKey = await signAndRecover(path)

    // Cosmos returns compressed key (02/03 + x), recovery returns uncompressed (04 + x + y)
    expect(recoveredPubKey.slice(2, 66)).toBe(derivedPubKey.slice(2, 66))
  }, 120_000)
})
