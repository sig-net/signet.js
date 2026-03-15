import 'dotenv/config'

import { fromHex } from '@cosmjs/encoding'
import { DirectSecp256k1Wallet } from '@cosmjs/proto-signing'
import { SigningStargateClient } from '@cosmjs/stargate'
import { describe, it, expect, beforeAll } from 'vitest'

import { chainAdapters } from '../../../src'
import {
  COSMOS_RPC_URL,
  COSMOS_REST_URL,
  TEST_PRIVATE_KEY,
  createSepoliaMpcContract,
} from '../../utils/test-utils'

const MPC_PATH = 'e2e-cosmos'
const MPC_KEY_VERSION = 1

// Pre-funded test account from docker/cosmos/Dockerfile
const FUNDER_PRIVATE_KEY = TEST_PRIVATE_KEY

describe('Cosmos E2E broadcast (local node via Sepolia MPC)', () => {
  const { account, mpcContract } = createSepoliaMpcContract()

  const cosmos = new chainAdapters.cosmos.Cosmos({
    contract: mpcContract,
    chainId: 'cosmoshub-4',
    endpoints: {
      rpcUrl: COSMOS_RPC_URL,
      restUrl: COSMOS_REST_URL,
    },
  })

  let mpcAddress: string
  let mpcPublicKey: string

  beforeAll(async () => {
    const derived = await cosmos.deriveAddressAndPublicKey(
      account.address,
      MPC_PATH,
      MPC_KEY_VERSION
    )
    mpcAddress = derived.address
    mpcPublicKey = derived.publicKey

    // Fund the MPC-derived address from the pre-funded test account
    const funderWallet = await DirectSecp256k1Wallet.fromKey(
      fromHex(FUNDER_PRIVATE_KEY),
      'cosmos'
    )
    const [funderAccount] = await funderWallet.getAccounts()
    const signingClient = await SigningStargateClient.connectWithSigner(
      COSMOS_RPC_URL,
      funderWallet
    )

    await signingClient.sendTokens(
      funderAccount.address,
      mpcAddress,
      [{ denom: 'uatom', amount: '1000000' }],
      { amount: [{ denom: 'uatom', amount: '2000' }], gas: '200000' }
    )
  }, 30_000)

  it('should sign via Sepolia MPC and broadcast on local cosmos', async () => {
    const { balance } = await cosmos.getBalance(mpcAddress)
    expect(balance).toBeGreaterThan(0n)

    const { hashesToSign, transaction } =
      await cosmos.prepareTransactionForSigning({
        address: mpcAddress,
        publicKey: mpcPublicKey,
        messages: [
          {
            typeUrl: '/cosmos.bank.v1beta1.MsgSend',
            value: {
              fromAddress: mpcAddress,
              toAddress: mpcAddress,
              amount: [{ denom: 'uatom', amount: '1000' }],
            },
          },
        ],
      })

    expect(hashesToSign).toHaveLength(1)

    const mpcSignature = await mpcContract.sign(
      {
        payload: hashesToSign[0],
        path: MPC_PATH,
        key_version: MPC_KEY_VERSION,
      },
      { sign: {}, retry: { delay: 5_000, retryCount: 12 } }
    )

    const signedTx = cosmos.finalizeTransactionSigning({
      transaction,
      rsvSignatures: [mpcSignature],
    })

    const txHash = await cosmos.broadcastTx(signedTx)

    expect(txHash).toHaveLength(64)

    const { balance: balanceAfter } = await cosmos.getBalance(mpcAddress)
    expect(balanceAfter).toBeLessThan(balance)
  }, 120_000)
})
