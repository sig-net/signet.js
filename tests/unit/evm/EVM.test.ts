import {
  createPublicClient,
  createWalletClient,
  hexToBytes,
  http,
  parseEther,
  recoverMessageAddress,
  recoverTypedDataAddress,
} from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { hardhat } from 'viem/chains'
import { describe, expect, it } from 'vitest'

import { chainAdapters, constants, contracts } from '../../../src'
import { TEST_PRIVATE_KEY, mockSign } from '../../utils/test-utils'

describe('EVM', async () => {
  const privateKey = `0x${TEST_PRIVATE_KEY}` as const
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

  const privKeyBytes = hexToBytes(privateKey as `0x${string}`)

  const contract = new contracts.evm.ChainSignatureContract({
    publicClient,
    walletClient,
    contractAddress: constants.CONTRACT_ADDRESSES.ETHEREUM
      .TESTNET as `0x${string}`,
  })

  const evm = new chainAdapters.evm.EVM({
    contract,
    publicClient,
  })

  it('should sign a message', async () => {
    const message = 'Hello, World!'
    const { hashToSign } = await evm.prepareMessageForSigning(message)

    const mpcSignature = mockSign(hashToSign, privKeyBytes)

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

    const mpcSignature = mockSign(hashToSign, privKeyBytes)

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

    const mpcSignature = mockSign(hashesToSign[0], privKeyBytes)

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

    const destBalance = await publicClient.getBalance({
      address: transactionInput.to,
    })
    expect(destBalance).toBe(parseEther('1'))
  })
})
