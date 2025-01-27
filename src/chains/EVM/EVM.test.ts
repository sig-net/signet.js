import { secp256k1 } from '@noble/curves/secp256k1'
import BN from 'bn.js'
import { createPublicClient, createWalletClient, http, parseEther } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { hardhat } from 'viem/chains'
import { describe, expect, it } from 'vitest'

import { EVM } from './EVM'

import type { ChainSignatureContract } from '../ChainSignatureContract'
import type { UncompressedPubKeySEC1 } from '../types'

describe('EVM', () => {
  const privateKey =
    '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef'
  const testAccount = privateKeyToAccount(privateKey)
  const rpcUrl = 'http://127.0.0.1:8545'

  const publicClient = createPublicClient({
    chain: hardhat,
    transport: http(rpcUrl),
  })

  const walletClient = createWalletClient({
    chain: hardhat,
    transport: http(rpcUrl),
  })

  const contract: ChainSignatureContract = {
    sign: async ({ payload }) => {
      const messageBytes = new Uint8Array(payload)
      const privKeyBytes = new Uint8Array(
        Buffer.from(privateKey.slice(2), 'hex')
      )
      const { r, s, recovery } = secp256k1.sign(messageBytes, privKeyBytes)
      return {
        r: r.toString(16).padStart(64, '0'),
        s: s.toString(16).padStart(64, '0'),
        v: recovery,
      }
    },
    getDerivedPublicKey: async () => {
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
    rpcUrl,
  })

  it('should sign a message', async () => {
    const message = 'Hello, World!'
    const { mpcPayloads } = await evm.getMPCPayloadAndMessage({
      message,
      from: testAccount.address,
    })

    const mpcSignature = await contract.sign({
      payload: mpcPayloads[0],
      path: '',
      key_version: 0,
    })

    const signature = evm.addMessageSignature({
      message,
      mpcSignatures: [mpcSignature],
    })

    const walletSignature = await walletClient.signMessage({
      account: testAccount,
      message,
    })

    expect(signature).toBe(walletSignature)
  })

  it('should sign typed data', async () => {
    const typedData = {
      domain: {
        name: 'Test',
        version: '1',
        chainId: 31337,
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

    const { mpcPayloads } = await evm.getMPCPayloadAndTypedData({
      ...typedData,
      from: testAccount.address,
    })

    const mpcSignature = await contract.sign({
      payload: mpcPayloads[0],
      path: '',
      key_version: 0,
    })

    const signature = evm.addTypedDataSignature({
      typedData,
      mpcSignatures: [mpcSignature],
    })

    const walletSignature = await walletClient.signTypedData({
      account: testAccount,
      ...typedData,
    })

    expect(signature).toBe(walletSignature)
  })

  it('should sign a transaction', async () => {
    const transaction = {
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
      chainId: 31337,
      accessList: [],
    }

    const { mpcPayloads } = await evm.getMPCPayloadAndTransaction(transaction)

    const mpcSignature = await contract.sign({
      payload: mpcPayloads[0],
      path: '',
      key_version: 0,
    })

    const signature = evm.addSignature({
      transaction,
      mpcSignatures: [mpcSignature],
    })

    const walletSignature = await walletClient.signTransaction({
      account: testAccount,
      ...transaction,
    })

    expect(signature).toBe(walletSignature)
  })
})
