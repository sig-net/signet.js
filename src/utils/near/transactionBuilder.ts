import type {
  Action,
  FinalExecutionOutcome,
  NetworkId,
} from '@near-wallet-selector/core'
import {
  type RSVSignature,
  type KeyDerivationPath,
  type MPCSignature,
} from '../../signature/types'
import { type MPCPayloads } from '../../chains/types'
import { ChainSignaturesContract } from './contract'
import { type ExecutionOutcomeWithId } from 'near-api-js/lib/providers'
import { NEAR_MAX_GAS } from './constants'
import { type NFTKeysContracts, type ChainSignatureContractIds } from './types'
import { toRSV } from '../../signature'

export const mpcPayloadsToChainSigTransaction = async ({
  networkId,
  contractId,
  mpcPayloads,
  path,
}: {
  networkId: NetworkId
  contractId: ChainSignatureContractIds
  mpcPayloads: MPCPayloads
  path: KeyDerivationPath
}): Promise<{
  receiverId: string
  actions: Action[]
}> => {
  const contract = new ChainSignaturesContract({
    networkId,
    contractId,
  })

  const currentContractFee = await contract.getCurrentSignatureDeposit()

  return {
    receiverId: contractId,
    actions: mpcPayloads.map(({ payload }) => ({
      type: 'FunctionCall',
      params: {
        methodName: 'sign',
        args: {
          request: {
            payload: Array.from(payload),
            path,
            key_version: 0,
          },
        },
        gas: NEAR_MAX_GAS.toString(),
        deposit: currentContractFee?.toString() || '1',
      },
    })),
  }
}

export const mpcPayloadsToNFTKeysTransaction = async ({
  networkId,
  chainSigContract,
  nftKeysContract,
  mpcPayloads,
  path,
  tokenId,
}: {
  networkId: NetworkId
  chainSigContract: ChainSignatureContractIds
  nftKeysContract: NFTKeysContracts
  mpcPayloads: MPCPayloads
  path: KeyDerivationPath
  tokenId: string
}): Promise<{
  receiverId: string
  actions: Action[]
}> => {
  const contract = new ChainSignaturesContract({
    networkId,
    contractId: chainSigContract,
  })

  const currentContractFee = await contract.getCurrentSignatureDeposit()

  return {
    receiverId: nftKeysContract,
    actions: mpcPayloads.map(({ payload }) => ({
      type: 'FunctionCall',
      params: {
        methodName: 'ckt_sign_hash',
        args: {
          token_id: tokenId,
          path,
          payload: Array.from(payload),
        },
        gas: NEAR_MAX_GAS.toString(),
        deposit: currentContractFee?.toString() || '1',
      },
    })),
  }
}

export const responseToMpcSignature = ({
  response,
}: {
  response: FinalExecutionOutcome
}): RSVSignature | undefined => {
  const signature: string = response.receipts_outcome.reduce<string>(
    (acc: string, curr: ExecutionOutcomeWithId) => {
      if (acc) {
        return acc
      }
      const { status } = curr.outcome
      return (
        (typeof status === 'object' &&
          status.SuccessValue &&
          status.SuccessValue !== '' &&
          Buffer.from(status.SuccessValue, 'base64').toString('utf-8')) ||
        ''
      )
    },
    ''
  )

  if (signature) {
    const parsedJSONSignature = JSON.parse(signature) as {
      Ok: MPCSignature
    }

    return toRSV(parsedJSONSignature.Ok)
  } else {
    return undefined
  }
}
