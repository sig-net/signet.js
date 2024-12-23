import { Bitcoin } from '../../../chains/Bitcoin/Bitcoin'
import {
  type BitcoinRequest,
  type CosmosRequest,
  type EVMRequest,
} from '../types'
import { Cosmos } from '../../../chains/Cosmos/Cosmos'
import { EVM } from '../../../chains/EVM/EVM'
import { type Response } from '../../../chains/types'
import { ChainSignaturesContract } from '../contract'
import { type KeyPair } from '@near-js/crypto'
import { getNearAccount } from '../account'

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

    const contract = new ChainSignaturesContract({
      networkId: req.nearAuthentication.networkId,
      contractId: req.chainConfig.contract,
      accountId: account.accountId,
      keypair: keyPair,
    })

    const evm = new EVM({
      providerUrl: req.chainConfig.providerUrl,
      contract,
    })

    const { transaction, mpcPayloads } = await evm.getMPCPayloadAndTransaction(
      req.transaction
    )

    const signature = await contract.sign({
      payload: mpcPayloads[0].payload,
      path: req.derivationPath,
      key_version: 0,
    })

    const txHash = await evm.addSignatureAndBroadcast({
      transaction,
      mpcSignatures: [signature],
    })

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

    const contract = new ChainSignaturesContract({
      networkId: req.nearAuthentication.networkId,
      contractId: req.chainConfig.contract,
      accountId: account.accountId,
      keypair: keyPair,
    })

    const btc = new Bitcoin({
      providerUrl: req.chainConfig.providerUrl,
      contract,
      network: req.chainConfig.network,
    })

    const { transaction, mpcPayloads } = await btc.getMPCPayloadAndTransaction(
      req.transaction
    )

    const signatures = await Promise.all(
      mpcPayloads.map(
        async ({ payload }) =>
          await contract.sign({
            payload,
            path: req.derivationPath,
            key_version: 0,
          })
      )
    )

    const txHash = await btc.addSignatureAndBroadcast({
      transaction,
      mpcSignatures: signatures,
    })

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

    const contract = new ChainSignaturesContract({
      networkId: req.nearAuthentication.networkId,
      contractId: req.chainConfig.contract,
      accountId: account.accountId,
      keypair: keyPair,
    })

    const cosmos = new Cosmos({
      contract,
      chainId: req.chainConfig.chainId,
    })

    const { transaction, mpcPayloads } =
      await cosmos.getMPCPayloadAndTransaction(req.transaction)

    const signatures = await Promise.all(
      mpcPayloads.map(
        async ({ payload }) =>
          await contract.sign({
            payload,
            path: req.derivationPath,
            key_version: 0,
          })
      )
    )

    const txHash = await cosmos.addSignatureAndBroadcast({
      transaction,
      mpcSignatures: signatures,
    })

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
