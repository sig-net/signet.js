import 'dotenv/config'

import { ripemd160, sha256 } from '@cosmjs/crypto'
import { fromHex, toBech32 } from '@cosmjs/encoding'
import { DirectSecp256k1Wallet } from '@cosmjs/proto-signing'
import { SigningStargateClient } from '@cosmjs/stargate'
import { secp256k1 } from '@noble/curves/secp256k1.js'
import { describe, it, expect, beforeAll } from 'vitest'

import { chainAdapters } from '../../../src'
import {
  COSMOS_RPC_URL,
  COSMOS_REST_URL,
  TEST_PRIVATE_KEY,
  DEST_PRIVATE_KEY,
  createSepoliaMpcContract,
} from '../../utils/test-utils'

const MPC_PATH = 'e2e-cosmos'
const MPC_KEY_VERSION = 1
const SEND_AMOUNT = '1000'

// Pre-funded test account from docker/cosmos/Dockerfile
const FUNDER_PRIVATE_KEY = TEST_PRIVATE_KEY

describe('Cosmos E2E broadcast (local node via Sepolia MPC)', () => {
  const { account, mpcContract } = createSepoliaMpcContract()

  const destPubKey = secp256k1.getPublicKey(fromHex(DEST_PRIVATE_KEY), true)
  const destAddress = toBech32('cosmos', ripemd160(sha256(destPubKey)))

  const cosmos = new chainAdapters.cosmos.Cosmos({
    contract: mpcContract,
    chainId: 'cosmoshub-4',
    endpoints: {
      rpcUrl: COSMOS_RPC_URL,
      restUrl: COSMOS_REST_URL,
    },
  })

  let mpcDerivedAddress: string
  let mpcPublicKey: string

  beforeAll(async () => {
    const derived = await cosmos.deriveAddressAndPublicKey(
      account.address,
      MPC_PATH,
      MPC_KEY_VERSION
    )
    mpcDerivedAddress = derived.address
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
      mpcDerivedAddress,
      [{ denom: 'uatom', amount: '1000000' }],
      { amount: [{ denom: 'uatom', amount: '2000' }], gas: '200000' }
    )
  }, 30_000)

  it('should sign via Sepolia MPC and broadcast on local cosmos', async () => {
    const { hashesToSign, transaction } =
      await cosmos.prepareTransactionForSigning({
        address: mpcDerivedAddress,
        publicKey: mpcPublicKey,
        messages: [
          {
            typeUrl: '/cosmos.bank.v1beta1.MsgSend',
            value: {
              fromAddress: mpcDerivedAddress,
              toAddress: destAddress,
              amount: [{ denom: 'uatom', amount: SEND_AMOUNT }],
            },
          },
        ],
      })

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

    await cosmos.broadcastTx(signedTx)

    const { balance: destBalance } = await cosmos.getBalance(destAddress)
    expect(destBalance).toBe(BigInt(SEND_AMOUNT))
  }, 120_000)
})
