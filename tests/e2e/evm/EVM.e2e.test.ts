import 'dotenv/config'

import {
  createPublicClient,
  createWalletClient,
  http,
  parseEther,
} from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { hardhat } from 'viem/chains'
import { sepolia } from 'viem/chains'
import { describe, it, expect } from 'vitest'

import { chainAdapters, constants, contracts } from '../../../src'

const SEPOLIA_RPC_URL =
  process.env.SEPOLIA_RPC_URL ??
  `https://sepolia.infura.io/v3/${process.env.INFURA_API_KEY ?? ''}`
const SEPOLIA_PRIVATE_KEY = process.env.SEPOLIA_PRIVATE_KEY ?? ''
const LOCAL_RPC_URL = 'http://127.0.0.1:8545'
const MPC_PATH = 'e2e-test'
const MPC_KEY_VERSION = 1

describe('EVM E2E broadcast (MPC on Sepolia, broadcast on local hardhat)', () => {
  const account = privateKeyToAccount(SEPOLIA_PRIVATE_KEY as `0x${string}`)

  // Sepolia clients — used for MPC contract interactions
  const sepoliaPublicClient = createPublicClient({
    chain: sepolia,
    transport: http(SEPOLIA_RPC_URL),
  })

  const sepoliaWalletClient = createWalletClient({
    account,
    chain: sepolia,
    transport: http(SEPOLIA_RPC_URL),
  })

  const mpcContract = new contracts.evm.ChainSignatureContract({
    publicClient: sepoliaPublicClient,
    walletClient: sepoliaWalletClient,
    contractAddress: constants.CONTRACT_ADDRESSES.ETHEREUM
      .TESTNET as `0x${string}`,
  })

  // Local hardhat client — used for tx preparation and broadcast
  const localPublicClient = createPublicClient({
    chain: hardhat,
    transport: http(LOCAL_RPC_URL),
  })

  const evm = new chainAdapters.evm.EVM({
    publicClient: localPublicClient,
    contract: mpcContract,
  })

  it('should sign via Sepolia MPC and broadcast on local hardhat', async () => {
    const { address: mpcAddress } = await evm.deriveAddressAndPublicKey(
      account.address,
      MPC_PATH,
      MPC_KEY_VERSION
    )

    // Fund MPC address on local hardhat
    await localPublicClient.request({
      // @ts-expect-error: hardhat_setBalance is a valid hardhat RPC method
      method: 'hardhat_setBalance',
      params: [mpcAddress as `0x${string}`, '0x4563918244F40000'], // 5 ETH
    })

    const { hashesToSign, transaction } =
      await evm.prepareTransactionForSigning({
        from: mpcAddress as `0x${string}`,
        to: mpcAddress as `0x${string}`,
        value: parseEther('0.001'),
      })

    const mpcSignature = await mpcContract.sign(
      { payload: hashesToSign[0], path: MPC_PATH, key_version: MPC_KEY_VERSION },
      { sign: {}, retry: { delay: 5_000, retryCount: 12 } }
    )

    const signedTx = evm.finalizeTransactionSigning({
      transaction,
      rsvSignatures: [mpcSignature],
    })

    const txHash = await evm.broadcastTx(signedTx)
    const receipt = await localPublicClient.waitForTransactionReceipt({
      hash: txHash,
    })

    expect(receipt.status).toBe('success')
    expect(receipt.from.toLowerCase()).toBe(mpcAddress.toLowerCase())
  }, 120_000)
})
