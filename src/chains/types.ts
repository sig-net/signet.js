import { type SignArgs } from '@chains/ChainSignatureContract'

export type MPCPayloads = Array<SignArgs['payload']>

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

interface OldMpcSignature {
  big_r: {
    affine_point: string
  }
  s: {
    scalar: string
  }
  recovery_id: number
}

interface NewMpcSignature {
  big_r: string
  s: string
  recovery_id: number
}

export type MPCSignature = OldMpcSignature | NewMpcSignature
