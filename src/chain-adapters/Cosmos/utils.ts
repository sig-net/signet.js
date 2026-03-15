import { chains, assetLists } from 'chain-registry'

import { type ChainInfo } from '@chain-adapters/Cosmos/types'

export const fetchChainInfo = async (chainId: string): Promise<ChainInfo> => {
  const chainInfo = chains.find((chain) => chain.chainId === chainId)
  if (!chainInfo) {
    throw new Error(`Chain info not found for chainId: ${chainId}`)
  }

  const { bech32Prefix: prefix, chainId: expectedChainId } = chainInfo
  const denom = chainInfo.staking?.stakingTokens?.[0]?.denom
  const rpcUrl = chainInfo.apis?.rpc?.[0]?.address
  const restUrl = chainInfo.apis?.rest?.[0]?.address
  const gasPrice = chainInfo.fees?.feeTokens?.[0]?.averageGasPrice

  if (
    !prefix ||
    !denom ||
    !rpcUrl ||
    !restUrl ||
    !expectedChainId ||
    gasPrice === undefined
  ) {
    throw new Error(
      `Missing required chain information for ${chainInfo.chainName}`
    )
  }

  const assetList = assetLists.find(
    (al) => al.chainName === chainInfo.chainName
  )
  const asset = assetList?.assets.find((asset) => asset.base === denom)
  const decimals = asset?.denomUnits.find(
    (unit) => unit.denom === asset.display
  )?.exponent

  if (decimals === undefined) {
    throw new Error(
      `Could not find decimals for ${denom} on chain ${chainInfo.chainName}`
    )
  }

  return { prefix, denom, rpcUrl, restUrl, expectedChainId, gasPrice, decimals }
}
