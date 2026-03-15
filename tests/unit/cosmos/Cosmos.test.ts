import { ripemd160, sha256 } from '@cosmjs/crypto'
import { fromHex, toBech32, toHex } from '@cosmjs/encoding'
import { secp256k1 } from '@noble/curves/secp256k1.js'
import { describe, expect, it } from 'vitest'

import { chainAdapters } from '../../../src'
import {
  COSMOS_RPC_URL,
  COSMOS_REST_URL,
  TEST_PRIVATE_KEY,
  DEST_PRIVATE_KEY,
  mockSign,
  createDummyContract,
} from '../../utils/test-utils'

describe('Cosmos', () => {
  const privKeyBytes = fromHex(TEST_PRIVATE_KEY)

  const compressedPubKey = secp256k1.getPublicKey(privKeyBytes, true)
  const compressedPubKeyHex = toHex(compressedPubKey)

  const pubKeySha256 = sha256(compressedPubKey)
  const address = toBech32('cosmos', ripemd160(pubKeySha256))

  const destPubKey = secp256k1.getPublicKey(fromHex(DEST_PRIVATE_KEY), true)
  const destAddress = toBech32('cosmos', ripemd160(sha256(destPubKey)))

  const contract = createDummyContract()

  // chainId must match the gaiad Docker container config (docker/cosmos/Dockerfile).
  // If these diverge, signing fails with a cryptic signature verification error
  // because the signed bytes include the chain ID.
  const cosmos = new chainAdapters.cosmos.Cosmos({
    contract,
    chainId: 'cosmoshub-4',
    endpoints: {
      rpcUrl: COSMOS_RPC_URL,
      restUrl: COSMOS_REST_URL,
    },
  })

  it('should sign and broadcast a bank send transaction', async () => {
    const { hashesToSign, transaction } =
      await cosmos.prepareTransactionForSigning({
        address,
        publicKey: compressedPubKeyHex,
        messages: [
          {
            typeUrl: '/cosmos.bank.v1beta1.MsgSend',
            value: {
              fromAddress: address,
              toAddress: destAddress,
              amount: [{ denom: 'uatom', amount: '1000' }],
            },
          },
        ],
      })

    expect(hashesToSign).toHaveLength(1)
    expect(hashesToSign[0]).toHaveLength(32)

    const rsvSignature = mockSign(hashesToSign[0], privKeyBytes)

    const signedTx = cosmos.finalizeTransactionSigning({
      transaction,
      rsvSignatures: [rsvSignature],
    })

    const txHash = await cosmos.broadcastTx(signedTx)

    expect(txHash).toHaveLength(64)

    const { balance: destBalance } = await cosmos.getBalance(destAddress)
    expect(destBalance).toBe(1000n)
  }, 30_000)

  it('should reject broadcast of a transaction signed with the wrong key', async () => {
    const wrongKeyBytes = fromHex(DEST_PRIVATE_KEY)

    const { hashesToSign, transaction } =
      await cosmos.prepareTransactionForSigning({
        address,
        publicKey: compressedPubKeyHex,
        messages: [
          {
            typeUrl: '/cosmos.bank.v1beta1.MsgSend',
            value: {
              fromAddress: address,
              toAddress: destAddress,
              amount: [{ denom: 'uatom', amount: '1000' }],
            },
          },
        ],
      })

    const wrongSignature = mockSign(hashesToSign[0], wrongKeyBytes)

    const signedTx = cosmos.finalizeTransactionSigning({
      transaction,
      rsvSignatures: [wrongSignature],
    })

    await expect(cosmos.broadcastTx(signedTx)).rejects.toThrow()
  }, 30_000)
})
