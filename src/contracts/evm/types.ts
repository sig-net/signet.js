import type { Address, Hex } from 'viem'

export interface RetryOptions {
  delay?: number
  retryCount?: number
}
export interface SignOptions {
  sign: {
    algo?: string
    dest?: string
    params?: string
  }
  retry: RetryOptions
  transaction?: {
    gas?: bigint
    maxFeePerGas?: bigint
    maxPriorityFeePerGas?: bigint
    nonce?: number
  }
}

export interface SignatureErrorData {
  requestId: string
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

export interface RequestIdArgs {
  address: Address
  payload: Hex
  path: string
  keyVersion: number
  chainId: bigint
  algo: string
  dest: string
  params: string
}
