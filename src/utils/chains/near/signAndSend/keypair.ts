import { type KeyPair } from '@near-js/crypto'

import { Bitcoin, Cosmos, EVM } from '@chains'
import { BTCRpcAdapters } from '@chains/Bitcoin/BTCRpcAdapter'
import { getNearAccount } from '@utils/chains/near/account'
import { ChainSignatureContract } from '@utils/chains/near/ChainSignatureContract'
import {
  type Response,
  type BitcoinRequest,
  type CosmosRequest,
  type EVMRequest,
} from '@utils/chains/near/types'

export const EVMTransaction = async (
  req: EVMRequest,
  keyPair: KeyPair
): Promise<Response> => {
  try {
    const account = await getNearAccount({
      networkId: req.nearAuthentication.networkId,
      accountId: req.nearAuthentication.accountId,
      keypair: keyPair,
    })

    const contract = new ChainSignatureContract({
      networkId: req.nearAuthentication.networkId,
      contractId: req.chainConfig.contract,
      accountId: account.accountId,
      keypair: keyPair,
    })

    const evm = new EVM({
      rpcUrl: req.chainConfig.providerUrl,
      contract,
    })

    const { transaction, hashesToSign } =
      await evm.prepareTransactionForSigning(req.transaction)

    const signature = await contract.sign({
      payload: hashesToSign[0],
      path: req.derivationPath,
      key_version: 0,
    })

    const txSerialized = evm.attachTransactionSignature({
      transaction,
      rsvSignatures: [signature],
    })

    const txHash = await evm.broadcastTx(txSerialized)

    return {
      transactionHash: txHash,
      success: true,
    }
  } catch (e: unknown) {
    console.error(e)
    return {
      success: false,
      errorMessage: e instanceof Error ? e.message : String(e),
    }
  }
}

export const BTCTransaction = async (
  req: BitcoinRequest,
  keyPair: KeyPair
): Promise<Response> => {
  try {
    const account = await getNearAccount({
      networkId: req.nearAuthentication.networkId,
      accountId: req.nearAuthentication.accountId,
      keypair: keyPair,
    })

    const contract = new ChainSignatureContract({
      networkId: req.nearAuthentication.networkId,
      contractId: req.chainConfig.contract,
      accountId: account.accountId,
      keypair: keyPair,
    })

    const btc = new Bitcoin({
      btcRpcAdapter: new BTCRpcAdapters.Mempool(req.chainConfig.providerUrl),
      contract,
      network: req.chainConfig.network,
    })

    const { transaction, hashesToSign } =
      await btc.prepareTransactionForSigning(req.transaction)

    const signatures = await Promise.all(
      hashesToSign.map(
        async (payload) =>
          await contract.sign({
            payload,
            path: req.derivationPath,
            key_version: 0,
          })
      )
    )

    const txSerialized = btc.attachTransactionSignature({
      transaction,
      rsvSignatures: signatures,
    })

    const txHash = await btc.broadcastTx(txSerialized)

    return {
      transactionHash: txHash,
      success: true,
    }
  } catch (e: unknown) {
    return {
      success: false,
      errorMessage: e instanceof Error ? e.message : String(e),
    }
  }
}

export const CosmosTransaction = async (
  req: CosmosRequest,
  keyPair: KeyPair
): Promise<Response> => {
  try {
    const account = await getNearAccount({
      networkId: req.nearAuthentication.networkId,
      accountId: req.nearAuthentication.accountId,
      keypair: keyPair,
    })

    const contract = new ChainSignatureContract({
      networkId: req.nearAuthentication.networkId,
      contractId: req.chainConfig.contract,
      accountId: account.accountId,
      keypair: keyPair,
    })

    const cosmos = new Cosmos({
      contract,
      chainId: req.chainConfig.chainId,
    })

    const { transaction, hashesToSign } =
      await cosmos.prepareTransactionForSigning(req.transaction)

    const signatures = await Promise.all(
      hashesToSign.map(
        async (payload) =>
          await contract.sign({
            payload,
            path: req.derivationPath,
            key_version: 0,
          })
      )
    )

    const txSerialized = cosmos.attachTransactionSignature({
      transaction,
      rsvSignatures: signatures,
    })

    const txHash = await cosmos.broadcastTx(txSerialized)

    return {
      transactionHash: txHash,
      success: true,
    }
  } catch (e: unknown) {
    console.error(e)
    return {
      success: false,
      errorMessage: e instanceof Error ? e.message : String(e),
    }
  }
}
