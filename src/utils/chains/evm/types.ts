import type { Hex, PublicClient, WalletClient } from 'viem'

import type { NajPublicKey } from '@chains/types'

export interface ChainSignatureContractArgs {
  publicClient: PublicClient
  walletClient: WalletClient
  contractAddress: Hex
  rootPublicKey?: NajPublicKey
}

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

export interface SignatureData {
  signature: {
    bigR: { x: bigint; y: bigint }
    s: bigint
    recoveryId: number
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
