import { type SignArgs } from '@chains/ChainSignatureContract'

export type MPCPayloads = Array<SignArgs['payload']>

export type UncompressedPubKeySEC1 = `04${string}`

export type KeyDerivationPath = string

export interface RSVSignature {
  r: string
  s: string
  v: number
}

export interface MPCSignature {
  big_r: {
    affine_point: string
  }
  s: {
    scalar: string
  }
  recovery_id: number
}
