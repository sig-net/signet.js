import 'dotenv/config'

import { DirectSecp256k1Wallet } from '@cosmjs/proto-signing'
import { SigningStargateClient } from '@cosmjs/stargate'
import { fromHex } from '@cosmjs/encoding'
import {
  createPublicClient,
  createWalletClient,
  http,
} from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { sepolia } from 'viem/chains'
import { describe, it, expect, beforeAll } from 'vitest'

import { chainAdapters, constants, contracts } from '../../../src'

const SEPOLIA_RPC_URL =
  process.env.SEPOLIA_RPC_URL ??
  `https://sepolia.infura.io/v3/${process.env.INFURA_API_KEY ?? ''}`
const SEPOLIA_PRIVATE_KEY = process.env.SEPOLIA_PRIVATE_KEY ?? ''
const COSMOS_RPC_URL = process.env.COSMOS_RPC_URL ?? 'http://localhost:26657'
const COSMOS_REST_URL = process.env.COSMOS_REST_URL ?? 'http://localhost:1317'
const MPC_PATH = 'e2e-cosmos'
const MPC_KEY_VERSION = 1

// Pre-funded test account from docker/cosmos/Dockerfile
const FUNDER_PRIVATE_KEY =
  '1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef'

describe('Cosmos E2E broadcast (local node via Sepolia MPC)', () => {
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
      { payload: hashesToSign[0], path: MPC_PATH, key_version: MPC_KEY_VERSION },
      { sign: {}, retry: { delay: 5_000, retryCount: 12 } }
    )

    const signedTx = cosmos.finalizeTransactionSigning({
      transaction,
      rsvSignatures: [mpcSignature],
    })

    const txHash = await cosmos.broadcastTx(signedTx)

    expect(txHash).toBeDefined()
    expect(txHash).toHaveLength(64)
  }, 120_000)
})
