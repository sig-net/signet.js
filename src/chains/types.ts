import { type SignArgs } from './ChainSignatureContract'

interface SuccessResponse {
  transactionHash: string
  success: true
}

interface FailureResponse {
  success: false
  errorMessage: string
}

export type Response = SuccessResponse | FailureResponse

export type MPCPayloads = Array<{ index: number; payload: SignArgs['payload'] }>

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
