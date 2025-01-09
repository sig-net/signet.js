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
