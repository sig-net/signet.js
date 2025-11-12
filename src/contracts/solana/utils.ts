import { encodeAbiParameters, parseAbiParameters, keccak256 } from 'viem'

export function generateRequestIdSolana({
  address,
  payload,
  path,
  keyVersion,
  chainId,
  algo,
  dest,
  params,
}: {
  address: string
  payload: Uint8Array | number[]
  path: string
  keyVersion: number
  chainId: string
  algo: string
  dest: string
  params: string
}): string {
  const payloadHex: `0x${string}` = ('0x' +
    Buffer.from(payload as any).toString('hex')) as `0x${string}`

  const encoded = encodeAbiParameters(
    parseAbiParameters(
      'string, bytes, string, uint32, string, string, string, string'
    ),
    [address, payloadHex, path, keyVersion, chainId, algo, dest, params]
  )

  return keccak256(encoded)
}
