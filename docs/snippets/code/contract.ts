import { contracts, constants } from 'signet.js'
import { createPublicClient, createWalletClient, http } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { sepolia } from 'viem/chains'
import { KeyPair, type KeyPairString } from '@near-js/crypto'

// Initialize NEAR connection with credentials from environment
const accountId = process.env.NEAR_ACCOUNT_ID
const privateKey = process.env.NEAR_PRIVATE_KEY as KeyPairString

if (!accountId || !privateKey) {
  throw new Error(
    'NEAR_ACCOUNT_ID and NEAR_PRIVATE_KEY must be set in environment'
  )
}

const keypair = KeyPair.fromString(privateKey)

const account = privateKeyToAccount(process.env.PRIVATE_KEY as `0x${string}`)

const publicClient = createPublicClient({
  chain: sepolia,
  transport: http(),
})

const walletClient = createWalletClient({
  account,
  chain: sepolia,
  transport: http(),
})

const evmChainSigContract = new contracts.evm.ChainSignatureContract({
  publicClient,
  walletClient,
  contractAddress: constants.CONTRACT_ADDRESSES.ETHEREUM
    .TESTNET_DEV as `0x${string}`,
})

const nearChainSigContract = new contracts.near.ChainSignatureContract({
  networkId: 'testnet',
  contractId: constants.CONTRACT_ADDRESSES.NEAR.TESTNET,
  accountId,
  keypair,
})
