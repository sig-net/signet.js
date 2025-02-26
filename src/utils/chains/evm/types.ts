import type { Hex } from 'viem'

export interface SignOptions {
  sign: {
    algo?: string
    dest?: string
    params?: string
  }
  retry: {
    delay?: number
    retryCount?: number
  }
}

export interface SignatureErrorData {
  requestId: string
  responder: string
  error: string
}

export interface SignRequest {
  payload: Hex
  path: string
  keyVersion: number
  algo: string
  dest: string
  params: string
}
