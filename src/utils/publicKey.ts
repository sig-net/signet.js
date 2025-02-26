import type { NajPublicKey } from '@chains/types'
import {
  CONTRACT_ADDRESSES,
  ROOT_PUBLIC_KEYS,
  type CHAINS,
} from '@utils/constants'

export const getRootPublicKey = (
  contractAddress: string,
  chain: keyof typeof CHAINS
): NajPublicKey => {
  const environment = Object.entries(CONTRACT_ADDRESSES[chain]).find(
    ([_, address]) => address.toLowerCase() === contractAddress.toLowerCase()
  )?.[0] as keyof typeof ROOT_PUBLIC_KEYS | undefined

  if (environment) {
    return ROOT_PUBLIC_KEYS[environment]
  }

  throw new Error(
    `Contract address ${contractAddress} not supported for chain ${chain}`
  )
}
