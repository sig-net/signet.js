import { base58 } from '@scure/base'
import elliptic from 'elliptic'
import { keccak256, recoverAddress, createPublicClient, http } from 'viem'

import { KDF_CHAIN_IDS } from '@constants'
import type { BaseChainSignatureContract } from '@contracts/ChainSignatureContract'
import {
  type RootPublicKey,
  type MPCSignature,
  type RSVSignature,
  type UncompressedPubKeySEC1,
} from '@types'

import { chainAdapters } from '..'
const { ec: EC } = elliptic

export const toRSV = (signature: MPCSignature): RSVSignature => {
  if (
    'bigR' in signature &&
    'x' in signature.bigR &&
    's' in signature &&
    typeof signature.s === 'bigint'
  ) {
    return {
      r: signature.bigR.x.toString(16).padStart(64, '0'),
      s: signature.s.toString(16).padStart(64, '0'),
      v: signature.recoveryId + 27,
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

/**
 * Normalizes any supported public key format to an uncompressed SEC1 public key.
 *
 * Supported formats:
 * - NAJ format: `secp256k1:base58...`
 * - Uncompressed SEC1: `04` prefix + 128 hex chars (64 bytes)
 * - Compressed SEC1: `02` or `03` prefix + 64 hex chars (32 bytes)
 */
export const normalizeToUncompressedPubKey = (
  key: RootPublicKey
): UncompressedPubKeySEC1 => {
  if (key.startsWith('secp256k1:')) {
    const decodedKey = base58.decode(key.split(':')[1])
    return `04${Buffer.from(decodedKey).toString('hex')}`
  }

  if (key.startsWith('04') && key.length === 130) {
    return key as UncompressedPubKeySEC1
  }

  if ((key.startsWith('02') || key.startsWith('03')) && key.length === 66) {
    const ec = new EC('secp256k1')
    const pubKeyPoint = ec.keyFromPublic(key, 'hex').getPublic(false, 'hex')
    return `04${pubKeyPoint.slice(2)}` as UncompressedPubKeySEC1
  }

  throw new Error(
    `Unsupported public key format. Expected NAJ (secp256k1:base58...), uncompressed (04 + 128 hex), or compressed (02/03 + 64 hex) key. Received: ${key.slice(0, 20)}...`
  )
}

const EPSILON_DERIVATION_PREFIX_V2 = 'sig.network v2.0.0 epsilon derivation'

/**
 * Derives a child public key from a parent public key using the Sig.Network epsilon derivation scheme.
 * The parent public keys are defined in @constants.ts
 *
 * @param rootUncompressedPubKeySEC1 - The parent public key in uncompressed SEC1 format (e.g. 04 || x || y)
 * @param predecessorId - The predecessor ID is the address of the account calling the signer contract (e.g EOA or Contract Address)
 * @param path - Optional derivation path suffix (defaults to empty string)
 * @param chainId - CAIP-2 chain identifier used for derivation
 * @param keyVersion - Key version controlling which derivation prefix to use (legacy v1 for 0, CAIP-2 v2 otherwise)
 * @returns The derived child public key in uncompressed SEC1 format (04 || x || y)
 */
export function deriveChildPublicKey(
  rootUncompressedPubKeySEC1: UncompressedPubKeySEC1,
  predecessorId: string,
  path: string = '',
  chainId: string,
  _keyVersion: number
): UncompressedPubKeySEC1 {
  const ec = new EC('secp256k1')
  const derivationPath = `${EPSILON_DERIVATION_PREFIX_V2}:${chainId}:${predecessorId}:${path}`

  let scalarHex = ''

  if (chainId === KDF_CHAIN_IDS.ETHEREUM) {
    scalarHex = keccak256(Buffer.from(derivationPath)).slice(2)
  } else if (chainId === KDF_CHAIN_IDS.SOLANA) {
    scalarHex = keccak256(Buffer.from(derivationPath)).slice(2)
  } else {
    throw new Error('Invalid chain ID')
  }

  const x = rootUncompressedPubKeySEC1.substring(2, 66)
  const y = rootUncompressedPubKeySEC1.substring(66)

  const oldPublicKeyPoint = ec.curve.point(x, y)
  const scalarTimesG = ec.g.mul(scalarHex)
  const newPublicKeyPoint = oldPublicKeyPoint.add(scalarTimesG)

  const newX = newPublicKeyPoint.getX().toString('hex').padStart(64, '0')
  const newY = newPublicKeyPoint.getY().toString('hex').padStart(64, '0')

  return `04${newX}${newY}`
}

/**
 * Verifies that a secp256k1 signature was created by the expected derived address
 * by recovering the signing address and comparing it with the address derived from the contract.
 *
 * @param signature - The RSV signature to verify
 * @param payload - The original message that was signed (as byte array)
 * @param requesterAddress - The address of the requester
 * @param path - The derivation path used for key generation
 * @param contract - The contract instance for deriving addresses
 * @returns Promise resolving to true if the recovered address matches the expected address
 */
export async function verifyRecoveredAddress(
  signature: RSVSignature,
  payload: number[] | Uint8Array,
  requesterAddress: string,
  path: string,
  contract: BaseChainSignatureContract,
  keyVersion: number
): Promise<boolean> {
  try {
    // Derive the expected address using EVM chain adapter
    // We use EVM adapter even for non-EVM chains since we're dealing with secp256k1 signatures
    const evm = new chainAdapters.evm.EVM({
      publicClient: createPublicClient({
        transport: http('https://dontcare.com'),
      }),
      contract,
    })

    const { address: expectedAddress } = await evm.deriveAddressAndPublicKey(
      requesterAddress,
      path,
      keyVersion
    )

    const recoveredAddress = await recoverAddress({
      hash: new Uint8Array(payload),
      signature: {
        r: `0x${signature.r}`,
        s: `0x${signature.s}`,
        yParity: signature.v,
      },
    })

    return recoveredAddress.toLowerCase() === expectedAddress.toLowerCase()
  } catch (error) {
    console.error('Signature verification failed:', error)
    return false
  }
}
