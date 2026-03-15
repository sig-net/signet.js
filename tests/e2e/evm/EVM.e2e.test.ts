import 'dotenv/config'

import { createPublicClient, http, parseEther } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { hardhat } from 'viem/chains'
import { describe, it, expect } from 'vitest'

import { chainAdapters } from '../../../src'
import {
  HARDHAT_RPC_URL,
  DEST_PRIVATE_KEY,
  createSepoliaMpcContract,
} from '../../utils/test-utils'

const MPC_PATH = 'e2e-test'
const MPC_KEY_VERSION = 1
const SEND_AMOUNT = parseEther('0.001')

describe('EVM E2E broadcast (MPC on Sepolia, broadcast on local hardhat)', () => {
  const { account, mpcContract } = createSepoliaMpcContract()
  const destAddress = privateKeyToAccount(
    `0x${DEST_PRIVATE_KEY}`
  ).address

  const localPublicClient = createPublicClient({
    chain: hardhat,
    transport: http(HARDHAT_RPC_URL),
  })

  const evm = new chainAdapters.evm.EVM({
    publicClient: localPublicClient,
    contract: mpcContract,
  })

  it('should sign via Sepolia MPC and broadcast on local hardhat', async () => {
    const { address: mpcDerivedAddress } = await evm.deriveAddressAndPublicKey(
      account.address,
      MPC_PATH,
      MPC_KEY_VERSION
    )

    await localPublicClient.request({
      // @ts-expect-error: hardhat_setBalance is a valid hardhat RPC method
      method: 'hardhat_setBalance',
      params: [mpcDerivedAddress as `0x${string}`, '0x4563918244F40000'], // 5 ETH
    })

    const { hashesToSign, transaction } =
      await evm.prepareTransactionForSigning({
        from: mpcDerivedAddress as `0x${string}`,
        to: destAddress,
        value: SEND_AMOUNT,
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

    await evm.broadcastTx(signedTx)

    const destBalance = await localPublicClient.getBalance({
      address: destAddress,
    })
    expect(destBalance).toBe(SEND_AMOUNT)
  }, 120_000)
})
