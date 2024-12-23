export const compressPubKey = (uncompressedPubKey: string): string => {
  const slicedPubKey = uncompressedPubKey.startsWith('04')
    ? uncompressedPubKey.slice(2)
    : uncompressedPubKey

  if (slicedPubKey.length !== 128) {
    throw new Error('Invalid uncompressed public key length')
  }

  const x = slicedPubKey.slice(0, 64)
  const y = slicedPubKey.slice(64)

  const isEven = parseInt(y.slice(-1), 16) % 2 === 0
  const prefix = isEven ? '02' : '03'

  return prefix + x
}
