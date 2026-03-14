import { secp256k1 } from '@noble/curves/secp256k1.js'
import { ripemd160, sha256 } from '@cosmjs/crypto'
import BN from 'bn.js'
import { bech32 } from 'bech32'
import { describe, expect, it } from 'vitest'

import type { BaseChainSignatureContract } from '../../contracts/ChainSignatureContract'
import type { UncompressedPubKeySEC1 } from '../../types'

import { Cosmos } from './Cosmos'

const COSMOS_RPC_URL = process.env.COSMOS_RPC_URL ?? 'http://localhost:26657'
const COSMOS_REST_URL = process.env.COSMOS_REST_URL ?? 'http://localhost:1317'

describe('Cosmos', () => {
  const privateKey =
    '1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef'
  const privKeyBytes = Buffer.from(privateKey, 'hex')

  const compressedPubKey = Buffer.from(
    secp256k1.getPublicKey(privKeyBytes, true)
  )
  const compressedPubKeyHex = compressedPubKey.toString('hex')

  const uncompressedPubKey = Buffer.from(
    secp256k1.getPublicKey(privKeyBytes, false)
  ).toString('hex') as UncompressedPubKeySEC1

  const pubKeySha256 = sha256(compressedPubKey)
  const address = bech32.encode(
    'cosmos',
    bech32.toWords(ripemd160(pubKeySha256))
  )

  const destPubKey = Buffer.from(
    secp256k1.getPublicKey(
      Buffer.from(
        'abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
        'hex'
      ),
      true
    )
  )
  const destAddress = bech32.encode(
    'cosmos',
    bech32.toWords(ripemd160(sha256(destPubKey)))
  )

  const contract = {
    getDerivedPublicKey: async () => uncompressedPubKey,
    getCurrentSignatureDeposit: async () => new BN(0),
  } as BaseChainSignatureContract

  const cosmos = new Cosmos({
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

    const msgBytes = new Uint8Array(hashesToSign[0])
    const sigBytes = secp256k1.sign(msgBytes, privKeyBytes, {
      prehash: false,
    })
    const sig = secp256k1.Signature.fromBytes(sigBytes)
    const pubKey = secp256k1.getPublicKey(privKeyBytes, false)
    let recovery = 0
    for (let rec = 0; rec < 2; rec++) {
      try {
        const pt = sig.addRecoveryBit(rec).recoverPublicKey(msgBytes)
        if (Buffer.from(pt.toBytes(false)).equals(Buffer.from(pubKey))) {
          recovery = rec
          break
        }
      } catch {}
    }

    const signedTx = cosmos.finalizeTransactionSigning({
      transaction,
      rsvSignatures: [
        {
          r: sig.r.toString(16).padStart(64, '0'),
          s: sig.s.toString(16).padStart(64, '0'),
          v: recovery + 27,
        },
      ],
    })

    const txHash = await cosmos.broadcastTx(signedTx)

    expect(txHash).toBeDefined()
    expect(txHash).toHaveLength(64)
  }, 30_000)
})
