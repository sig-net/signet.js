import { createPublicClient, createWalletClient, http } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { sepolia } from 'viem/chains'
import { chainAdapters, contracts, constants } from 'signet.js'

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

const chainSigContract = new contracts.evm.ChainSignatureContract({
  publicClient,
  walletClient,
  contractAddress: constants.CONTRACT_ADDRESSES.ETHEREUM
    .TESTNET_DEV as `0x${string}`,
})

const evmChain = new chainAdapters.evm.EVM({
  publicClient,
  contract: chainSigContract,
})

const cosmosChain = new chainAdapters.cosmos.Cosmos({
  chainId: 'cosmoshub-4',
  contract: chainSigContract,
})

const btcChain = new chainAdapters.btc.Bitcoin({
  network: 'testnet',
  btcRpcAdapter: new chainAdapters.btc.BTCRpcAdapters.Mempool(
    'https://mempool.space/api'
  ),
  contract: chainSigContract,
})
