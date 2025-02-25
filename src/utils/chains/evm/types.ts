import type BN from 'bn.js'
import type {
  Address,
  BlockNumber,
  BlockTag,
  Hash,
  Log,
  PublicClient as ViemPublicClient,
  WalletClient as ViemWalletClient,
} from 'viem'

import type { NajPublicKey } from '@chains/types'

export interface ChainSignatureContractArgs {
  publicClient: PublicClient
  walletClient: WalletClient
  contractAddress: `0x${string}`
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

export interface GetContractEventsParameters {
  address: Address | Address[]
  abi: any
  eventName: string
  args?: Record<string, any>
  fromBlock?: BlockNumber | BlockTag
  toBlock?: BlockNumber | BlockTag
  blockHash?: Hash
  strict?: boolean
}

export type PublicClient = Pick<ViemPublicClient, 'chain'> & {
  readContract: (args: any) => Promise<any>
  waitForTransactionReceipt: (args: { hash: `0x${string}` }) => Promise<any>
  getContractEvents: (args: GetContractEventsParameters) => Promise<Log[]>
}

export type WalletClient = Pick<ViemWalletClient, 'account'> & {
  writeContract: (args: any) => Promise<`0x${string}`>
}
