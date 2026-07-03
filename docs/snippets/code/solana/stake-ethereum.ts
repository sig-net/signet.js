// [!region import]
import { Connection, Keypair } from '@solana/web3.js'
import { AnchorProvider, Wallet } from '@coral-xyz/anchor'
import { contracts, chainAdapters, constants } from 'signet.js'
import {
  createPublicClient,
  encodeFunctionData,
  http,
  parseAbi,
  parseEther,
  zeroAddress,
} from 'viem'
import { mainnet } from 'viem/chains'
// [!endregion import]

// [!region setup]
const connection = new Connection('https://api.devnet.solana.com', 'confirmed')
const privateKey = JSON.parse(process.env.SOLANA_PRIVATE_KEY!)
const wallet = new Wallet(Keypair.fromSecretKey(new Uint8Array(privateKey)))
const provider = new AnchorProvider(
  connection,
  wallet,
  AnchorProvider.defaultOptions()
)

const chainSigContract = new contracts.solana.ChainSignatureContract({
  provider,
  programId: constants.CONTRACT_ADDRESSES.SOLANA.TESTNET_DEV,
  config: {
    requesterAddress: wallet.publicKey.toString(),
  },
})

const publicClient = createPublicClient({
  chain: mainnet,
  transport: http(),
})

const evm = new chainAdapters.evm.EVM({
  publicClient,
  contract: chainSigContract,
})
// [!endregion setup]

// [!region derive-address]
const path = 'lido-staking'
const keyVersion = 1

const { address: stakingAddress } = await evm.deriveAddressAndPublicKey(
  wallet.publicKey.toString(),
  path,
  keyVersion
)
// [!endregion derive-address]

// [!region build-stake-tx]
const LIDO_STETH = '0xae7ab96520DE3A18E5e111B5EaAb095312D7fE84'

const { transaction, hashesToSign } = await evm.prepareTransactionForSigning({
  from: stakingAddress as `0x${string}`,
  to: LIDO_STETH,
  value: parseEther('1'),
  data: encodeFunctionData({
    abi: parseAbi([
      'function submit(address _referral) payable returns (uint256)',
    ]),
    functionName: 'submit',
    args: [zeroAddress],
  }),
})
// [!endregion build-stake-tx]

// [!region sign-and-broadcast]
const rsvSignature = await chainSigContract.sign({
  payload: hashesToSign[0],
  path,
  key_version: keyVersion,
})

const signedTx = evm.finalizeTransactionSigning({
  transaction,
  rsvSignatures: [rsvSignature],
})

const txHash = await evm.broadcastTx(signedTx)
console.log('Stake transaction broadcast:', txHash)
// [!endregion sign-and-broadcast]
