import { KeyPair, type KeyPairString } from '@near-js/crypto'
import { EVM, utils } from 'signet.js'

// Initialize NEAR connection with credentials from environment
const accountId = process.env.NEAR_ACCOUNT_ID
const privateKey = process.env.NEAR_PRIVATE_KEY as KeyPairString

if (!accountId || !privateKey) {
  throw new Error(
    'NEAR_ACCOUNT_ID and NEAR_PRIVATE_KEY must be set in environment'
  )
}

const keypair = KeyPair.fromString(privateKey)

const contract = new utils.chains.near.ChainSignatureContract({
  networkId: 'testnet',
  contractId: 'v1.signer-prod.testnet',
  accountId,
  keypair,
})

// Initialize the chain
const chain = new EVM({
  rpcUrl: 'https://mainnet.infura.io/v3/YOUR-PROJECT-ID',
  contract,
})
