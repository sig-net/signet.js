export const compressPubKey = (uncompressedPubKey: string): string => {
  if (uncompressedPubKey.length !== 128) {
    throw new Error('Invalid uncompressed public key length')
  }

  const x = uncompressedPubKey.slice(0, 64)
  const y = uncompressedPubKey.slice(64)

  const isEven = parseInt(y.slice(-1), 16) % 2 === 0
  const prefix = isEven ? '02' : '03'

  return prefix + x
}
