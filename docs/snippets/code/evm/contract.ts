import { createPublicClient, createWalletClient, http } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { baseSepolia } from 'viem/chains'
import { utils } from 'signet.js'
// Initialize EVM connection with credentials from environment
const privateKey = process.env.PRIVATE_KEY as `0x${string}`

if (!privateKey) {
  throw new Error('PRIVATE_KEY must be set in environment')
}

// Create account from private key
const account = privateKeyToAccount(privateKey)

// Create viem clients for Base Sepolia
const publicClient = createPublicClient({
  chain: baseSepolia,
  transport: http(),
})

const walletClient = createWalletClient({
  account,
  chain: baseSepolia,
  transport: http(),
})

const contract = new utils.chains.evm.ChainSignatureContract({
  chain: baseSepolia,
  contractId: '0x1234567890123456789012345678901234567890',
  account,
})
