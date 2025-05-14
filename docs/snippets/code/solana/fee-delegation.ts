// [!region import]
import { Connection, Keypair } from '@solana/web3.js'
import { AnchorProvider, Wallet } from '@coral-xyz/anchor'
import { contracts, RSVSignature } from 'signet.js'
// [!endregion import]

// [!region create-connection]
const connection = new Connection('https://api.devnet.solana.com', 'confirmed')
const privateKeyString = process.env.SOLANA_PRIVATE_KEY!
const privateKey = JSON.parse(privateKeyString)
const feePayerWallet = new Wallet(
  Keypair.fromSecretKey(new Uint8Array(privateKey))
)
const provider = new AnchorProvider(
  connection,
  feePayerWallet,
  AnchorProvider.defaultOptions()
)
// [!endregion create-connection]

// [!region generate-keypair]
const requester = Keypair.generate()
// [!endregion generate-keypair]

// [!region initialize-contract]
const chainSigContract = new contracts.solana.ChainSignatureContract({
  provider,
  programId: 'ChainSignatureProgramIdHere',
  requesterAddress: requester.publicKey.toString(),
})
// [!endregion initialize-contract]

;(async () => {
  try {
    const signature = await chainSigContract.sign(
      {
        path: 'example_path',
        payload: Array(32).fill(1),
        key_version: 0,
      },
      {
        remainingAccounts: [
          { pubkey: requester.publicKey, isSigner: true, isWritable: false },
        ],
        remainingSigners: [requester],
      }
    )

    console.log('Received signature:', signature)
  } catch (error) {
    console.error('Transaction failed:', error)
  }
})()
