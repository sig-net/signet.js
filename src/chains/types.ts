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

export type UncompressedPublicKey = `04${string}`
