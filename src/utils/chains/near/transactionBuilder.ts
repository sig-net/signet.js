import type {
  Action,
  FinalExecutionOutcome,
  NetworkId,
} from '@near-wallet-selector/core'
import BN from 'bn.js'
import { getTransactionLastResult } from 'near-api-js/lib/providers'

import {
  type RSVSignature,
  type KeyDerivationPath,
  type MPCSignature,
  type HashToSign,
} from '@chains/types'
import { cryptography } from '@utils'
import { ChainSignatureContract } from '@utils/chains/near/ChainSignatureContract'
import { NEAR_MAX_GAS } from '@utils/chains/near/constants'
import { type ChainSignatureContractIds } from '@utils/chains/near/types'

export const mpcPayloadsToChainSigTransaction = async ({
  networkId,
  contractId,
  hashesToSign,
  path,
}: {
  networkId: NetworkId
  contractId: ChainSignatureContractIds
  hashesToSign: HashToSign[]
  path: KeyDerivationPath
}): Promise<{
  receiverId: string
  actions: Action[]
}> => {
  const contract = new ChainSignatureContract({
    networkId,
    contractId,
  })

  const currentContractFee = await contract.getCurrentSignatureDeposit()

  return {
    receiverId: contractId,
    actions: hashesToSign.map((payload) => ({
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
        gas: NEAR_MAX_GAS.div(new BN(hashesToSign.length)).toString(),
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
  const signature: MPCSignature = getTransactionLastResult(response)

  if (signature) {
    return cryptography.toRSV(signature)
  } else {
    return undefined
  }
}
