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

/**
 * Generates a unique request ID for EVM signature requests using keccak256 hashing.
 *
 * The request ID is computed by ABI-encoding the request parameters and hashing
 * the result. This ID is used to track signature requests and match them with
 * responses from the MPC network.
 *
 * @param request - The signature request parameters
 * @param request.address - The address of the requester (EVM address format)
 * @param request.payload - The data payload to be signed as a hex string
 * @param request.path - The derivation path for the signing key
 * @param request.keyVersion - The version of the signing key
 * @param request.chainId - The chain ID where the request originated
 * @param request.algo - The signing algorithm identifier
 * @param request.dest - The destination identifier for the signature
 * @param request.params - Additional parameters for the signing process
 * @returns The keccak256 hash of the encoded request as a hex string
 *
 * @example
 * ```typescript
 * const requestId = getRequestIdRespond({
 *   address: '0x1234...abcd',
 *   payload: '0xdeadbeef',
 *   path: 'ethereum,1',
 *   keyVersion: 0,
 *   chainId: 1n,
 *   algo: '',
 *   dest: '',
 *   params: '',
 * })
 * ```
 */
export const getRequestIdRespond = (request: RequestIdArgs): `0x${string}` => {
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
