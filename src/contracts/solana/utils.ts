import {
  encodeAbiParameters,
  encodePacked,
  parseAbiParameters,
  keccak256,
} from 'viem'

export interface SolanaRequestIdArgs {
  address: string
  payload: Uint8Array | number[]
  path: string
  keyVersion: number
  chainId: string
  algo: string
  dest: string
  params: string
}

export interface SolanaBidirectionalRequestIdArgs {
  sender: string
  payload: Uint8Array | number[]
  caip2Id: string
  keyVersion: number
  path: string
  algo: string
  dest: string
  params: string
}

/**
 * Generates a unique request ID for Solana signature requests using keccak256 hashing.
 *
 * The request ID is computed by ABI-encoding the request parameters and hashing
 * the result. This ID is used to track signature requests and match them with
 * responses from the MPC network.
 *
 * @param request - The signature request parameters
 * @param request.address - The sender's address (Solana public key as string)
 * @param request.payload - The data payload to be signed
 * @param request.path - The derivation path for the signing key
 * @param request.keyVersion - The version of the signing key
 * @param request.chainId - The CAIP-2 chain identifier (e.g., 'solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp')
 * @param request.algo - The signing algorithm identifier
 * @param request.dest - The destination identifier for the signature
 * @param request.params - Additional parameters for the signing process
 * @returns The keccak256 hash of the encoded request as a hex string
 *
 * @example
 * ```typescript
 * const requestId = getRequestIdRespond({
 *   address: 'So11111111111111111111111111111111111111112',
 *   payload: new Uint8Array([1, 2, 3, 4]),
 *   path: 'solana,1',
 *   keyVersion: 0,
 *   chainId: 'solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp',
 *   algo: '',
 *   dest: '',
 *   params: '',
 * })
 * ```
 */
export function getRequestIdRespond(request: SolanaRequestIdArgs): string {
  const payloadHex: `0x${string}` = ('0x' +
    Buffer.from(request.payload as Uint8Array).toString('hex')) as `0x${string}`

  const encoded = encodeAbiParameters(
    parseAbiParameters(
      'string, bytes, string, uint32, string, string, string, string'
    ),
    [
      request.address,
      payloadHex,
      request.path,
      request.keyVersion,
      request.chainId,
      request.algo,
      request.dest,
      request.params,
    ]
  )

  return keccak256(encoded)
}

/**
 * Generates a unique request ID for bidirectional sign operations using keccak256 hashing.
 *
 * Unlike `getRequestIdRespond`, this function uses packed encoding (solidityPacked)
 * instead of standard ABI encoding. This is used for cross-chain bidirectional
 * signing flows where the request originates from a different chain.
 *
 * @param request - The bidirectional signature request parameters
 * @param request.sender - The sender's address (Solana public key as string)
 * @param request.payload - The data payload to be signed
 * @param request.caip2Id - The CAIP-2 chain identifier (e.g., 'solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp')
 * @param request.keyVersion - The version of the signing key
 * @param request.path - The derivation path for the signing key
 * @param request.algo - The signing algorithm identifier
 * @param request.dest - The destination identifier for the signature
 * @param request.params - Additional parameters for the signing process
 * @returns The keccak256 hash of the packed encoded request as a hex string
 *
 * @example
 * ```typescript
 * const requestId = getRequestIdBidirectional({
 *   sender: 'So11111111111111111111111111111111111111112',
 *   payload: new Uint8Array([1, 2, 3, 4]),
 *   caip2Id: 'solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp',
 *   keyVersion: 0,
 *   path: 'ethereum,1',
 *   algo: '',
 *   dest: '',
 *   params: '',
 * })
 * ```
 */
export function getRequestIdBidirectional(
  request: SolanaBidirectionalRequestIdArgs
): string {
  const payloadHex: `0x${string}` = `0x${Buffer.from(request.payload as Uint8Array).toString('hex')}`

  const encoded = encodePacked(
    [
      'string',
      'bytes',
      'string',
      'uint32',
      'string',
      'string',
      'string',
      'string',
    ],
    [
      request.sender,
      payloadHex,
      request.caip2Id,
      request.keyVersion,
      request.path,
      request.algo,
      request.dest,
      request.params,
    ]
  )

  return keccak256(encoded)
}
