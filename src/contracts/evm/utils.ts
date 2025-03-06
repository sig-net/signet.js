import { encodeAbiParameters, keccak256 } from 'viem'
import * as chains from 'viem/chains'
import type { Chain } from 'viem/chains'

import { type RequestIdArgs } from './types'

export const getChain = (chainId: number): Chain => {
  for (const chain of Object.values(chains)) {
    if (chain.id === chainId) {
      return chain
    }
  }
  throw new Error('Chain not found')
}

export const getRequestId = (request: RequestIdArgs): `0x${string}` => {
  const encoded = encodeAbiParameters(
    [
      { type: 'address' },
      { type: 'bytes' },
      { type: 'string' },
      { type: 'uint32' },
      { type: 'uint256' },
      { type: 'string' },
      { type: 'string' },
      { type: 'string' },
    ],
    [
      request.address,
      request.payload,
      request.path,
      Number(request.keyVersion),
      request.chainId,
      request.algo,
      request.dest,
      request.params,
    ]
  )

  return keccak256(encoded)
}
