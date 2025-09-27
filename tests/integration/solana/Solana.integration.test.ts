import 'dotenv/config'
import { randomBytes } from 'node:crypto'

import { AnchorProvider, Wallet } from '@coral-xyz/anchor'
import { Connection, Keypair } from '@solana/web3.js'
import { describe, it, expect } from 'vitest'

import { constants, contracts } from '../../../src'

const DEFAULT_RPC =
  process.env.SOLANA_RPC_URL ?? 'https://api.devnet.solana.com'
const envSk: string = process.env.SOLANA_PRIVATE_KEY ?? ''
const PROGRAM_ID: string =
  process.env.SOLANA_PROGRAM_ID ?? constants.CONTRACT_ADDRESSES.SOLANA.TESTNET

describe('Solana ChainSignatures integration (emit!)', () => {
  const payer = Keypair.fromSecretKey(
    new Uint8Array(JSON.parse(envSk) as number[])
  )
  const solanaAddress = payer.publicKey.toString()
  console.log('Solana address:', solanaAddress)
  const connection = new Connection(DEFAULT_RPC, 'confirmed')
  const provider = new AnchorProvider(
    connection,
    new Wallet(payer),
    AnchorProvider.defaultOptions()
  )

  const contract = new contracts.solana.ChainSignatureContract({
    provider,
    programId: PROGRAM_ID,
    requesterAddress: payer.publicKey.toString(),
  })

  it('sign() returns RSV from on-chain emit!', async () => {
    const payload = Array.from(randomBytes(32))
    const path = ''
    const keyVersion = 0

    const rsv = await contract.sign(
      { payload, path, key_version: keyVersion },
      { retry: { delay: 5000, retryCount: 18 } }
    )

    expect(rsv).toBeDefined()
  }, 120_000)
})
