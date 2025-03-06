import { type SignArgs } from '@contracts/ChainSignatureContract'

export type HashToSign = SignArgs['payload']

type Base58String = string

export type NajPublicKey = `secp256k1:${Base58String}`

export type UncompressedPubKeySEC1 = `04${string}`

export type CompressedPubKeySEC1 = `02${string}` | `03${string}`

export type KeyDerivationPath = string

export interface RSVSignature {
  r: string
  s: string
  v: number
}

export interface NearNearMpcSignature {
  big_r: {
    affine_point: string
  }
  s: {
    scalar: string
  }
  recovery_id: number
}

export interface SigNetNearMpcSignature {
  big_r: string
  s: string
  recovery_id: number
}

export interface SigNetEvmMpcSignature {
  bigR: { x: bigint; y: bigint }
  s: bigint
  recoveryId: number
}

export type MPCSignature =
  | NearNearMpcSignature
  | SigNetNearMpcSignature
  | SigNetEvmMpcSignature
