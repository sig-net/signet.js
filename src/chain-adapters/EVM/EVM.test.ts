import { secp256k1 } from '@noble/curves/secp256k1.js'
import BN from 'bn.js'
import {
  createPublicClient,
  createWalletClient,
  http,
  parseEther,
  recoverMessageAddress,
  recoverTypedDataAddress,
} from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { hardhat } from 'viem/chains'
import { describe, expect, it } from 'vitest'

import type { ChainSignatureContract } from '../../contracts/ChainSignatureContract'
import type { UncompressedPubKeySEC1 } from '../../types'

import { EVM } from './EVM'

describe('EVM', async () => {
  const privateKey =
    '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef'
  const testAccount = privateKeyToAccount(privateKey)
  const rpcUrl = 'http://127.0.0.1:8545'

  const publicClient = createPublicClient({
    chain: hardhat,
    transport: http(rpcUrl),
  })

  const walletClient = createWalletClient({
    account: testAccount,
    chain: hardhat,
    transport: http(rpcUrl),
  })

  const mockSign = (payload: number[], privKey: Uint8Array) => {
    const sigBytes = secp256k1.sign(new Uint8Array(payload), privKey, {
      prehash: false,
    })
    const sig = secp256k1.Signature.fromBytes(sigBytes)
    const pubKey = secp256k1.getPublicKey(privKey, false)
    let recovery = 0
    for (let rec = 0; rec < 2; rec++) {
      try {
        const pt = sig.addRecoveryBit(rec).recoverPublicKey(new Uint8Array(payload))
        if (Buffer.from(pt.toBytes(false)).equals(Buffer.from(pubKey))) {
          recovery = rec
          break
        }
      } catch {}
    }
    return {
      r: sig.r.toString(16).padStart(64, '0'),
      s: sig.s.toString(16).padStart(64, '0'),
      v: recovery + 27,
    }
  }

  const privKeyBytes = new Uint8Array(
    Buffer.from(privateKey.slice(2), 'hex')
  )

  const contract: ChainSignatureContract = {
    sign: async ({ payload }) => mockSign(payload, privKeyBytes),
    getDerivedPublicKey: async ({ keyVersion }) => {
      return '04' as UncompressedPubKeySEC1
    },
    getPublicKey: async () => {
      const pubKey = secp256k1.getPublicKey(
        Buffer.from(privateKey.slice(2), 'hex')
      )
      return ('04' +
        Buffer.from(pubKey.slice(1)).toString('hex')) as UncompressedPubKeySEC1
    },
    getCurrentSignatureDeposit: async () => new BN(0),
  }

  const evm = new EVM({
    contract,
    publicClient: createPublicClient({
      transport: http(rpcUrl),
    }),
  })

  it('should sign a message', async () => {
    const message = 'Hello, World!'
    const { hashToSign } = await evm.prepareMessageForSigning(message)

    const mpcSignature = await contract.sign({
      payload: hashToSign,
      path: '',
      key_version: 0,
    })

    const signature = evm.finalizeMessageSigning({
      rsvSignature: mpcSignature,
    })

    const walletSignature = await walletClient.signMessage({
      message,
    })

    const recoveredAddress = await recoverMessageAddress({
      message,
      signature: walletSignature,
    })

    expect(recoveredAddress).toBe(testAccount.address)
    expect(signature).toBe(walletSignature)
  })

  it('should sign typed data', async () => {
    const typedData = {
      domain: {
        name: 'Test',
        version: '1',
        chainId: hardhat.id,
        verifyingContract:
          '0x1234567890123456789012345678901234567890' as `0x${string}`,
      },
      types: {
        Person: [
          { name: 'name', type: 'string' },
          { name: 'wallet', type: 'address' },
        ],
      },
      primaryType: 'Person' as const,
      message: {
        name: 'Bob',
        wallet: '0x1234567890123456789012345678901234567890' as `0x${string}`,
      },
    }

    const { hashToSign } = await evm.prepareTypedDataForSigning(typedData)

    const mpcSignature = await contract.sign({
      payload: hashToSign,
      path: '',
      key_version: 0,
    })

    const signature = evm.finalizeTypedDataSigning({
      rsvSignature: mpcSignature,
    })

    const walletSignature = await walletClient.signTypedData(typedData)

    const recoveredAddress = await recoverTypedDataAddress({
      ...typedData,
      signature: walletSignature,
    })

    expect(recoveredAddress).toBe(testAccount.address)
    expect(signature).toBe(walletSignature)
  })

  it('should sign a transaction', async () => {
    await publicClient.request({
      // @ts-expect-error: hardhat_setBalance is valid as we are using a hardhat client
      method: 'hardhat_setBalance',
      params: [testAccount.address, '0x4563918244f400000000'], // 5 ETH
    })

    const transactionInput = {
      from: testAccount.address,
      to: '0x1234567890123456789012345678901234567890' as `0x${string}`,
      value: parseEther('1'),
      maxFeePerGas: parseEther('0.001'),
      maxPriorityFeePerGas: parseEther('0.0001'),
      gas: 21000n,
      nonce: await publicClient.getTransactionCount({
        address: testAccount.address,
      }),
      type: 'eip1559' as const,
      chainId: hardhat.id,
      accessList: [],
    }

    const { hashesToSign, transaction } =
      await evm.prepareTransactionForSigning(transactionInput)

    const mpcSignature = await contract.sign({
      payload: hashesToSign[0],
      path: '',
      key_version: 0,
    })

    const tx = evm.finalizeTransactionSigning({
      transaction,
      rsvSignatures: [mpcSignature],
    })

    const walletSignature = await walletClient.signTransaction(transactionInput)

    expect(tx).toBe(walletSignature)

    const txHash = await evm.broadcastTx(tx)

    const txReceipt = await publicClient.getTransactionReceipt({
      hash: txHash,
    })

    expect(txReceipt.status).toBe('success')
  })

})
