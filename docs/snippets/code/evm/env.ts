import { createPublicClient, createWalletClient, http } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { sepolia } from 'viem/chains'

const privateKey = process.env.PRIVATE_KEY as `0x${string}`

if (!privateKey) {
  throw new Error('PRIVATE_KEY must be set in environment')
}

const account = privateKeyToAccount(privateKey)

const publicClient = createPublicClient({
  chain: sepolia,
  transport: http(),
})

const walletClient = createWalletClient({
  account,
  chain: sepolia,
  transport: http(),
})
