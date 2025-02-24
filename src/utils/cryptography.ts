import { base58 } from '@scure/base'
import { ec as EC } from 'elliptic'
import { keccak256 } from 'viem'

import {
  type NajPublicKey,
  type MPCSignature,
  type RSVSignature,
  type UncompressedPubKeySEC1,
} from '@chains/types'

export const toRSV = (signature: MPCSignature): RSVSignature => {
  if (typeof signature.big_r === 'object' && typeof signature.s === 'object') {
    return {
      r: signature.big_r.affine_point.substring(2),
      s: signature.s.scalar,
      v: signature.recovery_id + 27,
    }
  } else if (
    typeof signature.big_r === 'string' &&
    typeof signature.s === 'string'
  ) {
    return {
      r: signature.big_r.substring(2),
      s: signature.s,
      v: signature.recovery_id + 27,
    }
  }
  throw new Error('Invalid signature format')
}

/**
 * Compresses an uncompressed public key to its compressed format following SEC1 standards.
 * In SEC1, a compressed public key consists of a prefix (02 or 03) followed by the x-coordinate.
 * The prefix indicates whether the y-coordinate is even (02) or odd (03).
 *
 * @param uncompressedPubKeySEC1 - The uncompressed public key in hex format, with or without '04' prefix
 * @returns The compressed public key in hex format
 * @throws Error if the uncompressed public key length is invalid
 */
export const compressPubKey = (
  uncompressedPubKeySEC1: UncompressedPubKeySEC1
): string => {
  const slicedPubKey = uncompressedPubKeySEC1.slice(2)

  if (slicedPubKey.length !== 128) {
    throw new Error('Invalid uncompressed public key length')
  }

  const x = slicedPubKey.slice(0, 64)
  const y = slicedPubKey.slice(64)

  const isEven = parseInt(y.slice(-1), 16) % 2 === 0
  const prefix = isEven ? '02' : '03'

  return prefix + x
}

export const najToUncompressedPubKeySEC1 = (
  najPublicKey: NajPublicKey
): UncompressedPubKeySEC1 => {
  const decodedKey = base58.decode(najPublicKey.split(':')[1])
  return `04${Buffer.from(decodedKey).toString('hex')}`
}

/**
 * Derives a child public key from a parent public key using the sig.network v1.0.0 epsilon derivation scheme.
 * The parent public keys are defined in @constants.ts as ROOT_PUBLIC_KEY_V1_SIG_NET_TESTNET and ROOT_PUBLIC_KEY_DEV_V1_SIG_NET_TESTNET.
 *
 * @param najPublicKey - The parent public key in NAJ format (e.g. secp256k1:3Ww8iFjqTHufye5aRGUvrQqETegR4gVUcW8FX5xzscaN9ENhpkffojsxJwi6N1RbbHMTxYa9UyKeqK3fsMuwxjR5)
 * @param predecessorId - The predecessor ID calling the signer contract
 * @param path - Optional derivation path suffix (defaults to empty string)
 * @returns The derived child public key in uncompressed SEC1 format (04 || x || y)
 */
export function deriveChildPublicKey(
  rootUncompressedPubKeySEC1: UncompressedPubKeySEC1,
  predecessorId: string,
  path: string = ''
): UncompressedPubKeySEC1 {
  const ec = new EC('secp256k1')

  const CHAIN_ID_ETHEREUM = '0x1'
  const EPSILON_DERIVATION_PREFIX = 'sig.network v1.0.0 epsilon derivation'
  const derivationPath = `${EPSILON_DERIVATION_PREFIX},${CHAIN_ID_ETHEREUM},${predecessorId},${path}`

  const scalarHex = keccak256(Buffer.from(derivationPath)).slice(2)

  const x = rootUncompressedPubKeySEC1.substring(2, 66)
  const y = rootUncompressedPubKeySEC1.substring(66)

  const oldPublicKeyPoint = ec.curve.point(x, y)
  const scalarTimesG = ec.g.mul(scalarHex)
  const newPublicKeyPoint = oldPublicKeyPoint.add(scalarTimesG)

  const newX = newPublicKeyPoint.getX().toString('hex').padStart(64, '0')
  const newY = newPublicKeyPoint.getY().toString('hex').padStart(64, '0')

  return `04${newX}${newY}`
}
