import { createPublicClient, createWalletClient, http } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { sepolia } from 'viem/chains'
import { EVM, utils, Cosmos, Bitcoin, BTCRpcAdapters } from 'signet.js'

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

const evmChain = new EVM({
  rpcUrl: 'https://sepolia.infura.io/v3/YOUR-PROJECT-ID',
  contract: chainSigContract,
})

const cosmosChain = new Cosmos({
  chainId: 'cosmoshub-4',
  contract: chainSigContract,
})

const btcChain = new Bitcoin({
  network: 'testnet',
  btcRpcAdapter: new BTCRpcAdapters.Mempool('https://mempool.space/api'),
  contract: chainSigContract,
})
