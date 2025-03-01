import { utils } from 'signet.js'
import { createPublicClient, createWalletClient, http } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { sepolia } from 'viem/chains'

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

const chainSigContract = new utils.chains.evm.ChainSignatureContract({
  publicClient,
  walletClient,
  contractAddress: utils.constants.CONTRACT_ADDRESSES.ETHEREUM
    .TESTNET_DEV as `0x${string}`,
})
