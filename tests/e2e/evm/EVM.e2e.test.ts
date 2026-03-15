import 'dotenv/config'

import { createPublicClient, http, parseEther } from 'viem'
import { hardhat } from 'viem/chains'
import { describe, it, expect } from 'vitest'

import { chainAdapters } from '../../../src'
import { createSepoliaMpcContract } from '../../utils/test-utils'

const MPC_PATH = 'e2e-test'
const MPC_KEY_VERSION = 1

describe('EVM E2E broadcast (MPC on Sepolia, broadcast on local hardhat)', () => {
  const { account, mpcContract } = createSepoliaMpcContract()

  const localPublicClient = createPublicClient({
    chain: hardhat,
    transport: http('http://127.0.0.1:8545'),
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

    const balanceBefore = await localPublicClient.getBalance({
      address: mpcAddress as `0x${string}`,
    })

    const { hashesToSign, transaction } =
      await evm.prepareTransactionForSigning({
        from: mpcAddress as `0x${string}`,
        to: mpcAddress as `0x${string}`,
        value: parseEther('0.001'),
      })

    const mpcSignature = await mpcContract.sign(
      {
        payload: hashesToSign[0],
        path: MPC_PATH,
        key_version: MPC_KEY_VERSION,
      },
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

    const balanceAfter = await localPublicClient.getBalance({
      address: mpcAddress as `0x${string}`,
    })
    const gasSpent = receipt.gasUsed * receipt.effectiveGasPrice
    expect(balanceBefore - balanceAfter).toBe(gasSpent)
  }, 120_000)
})
