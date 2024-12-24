import type * as bitcoin from 'bitcoinjs-lib'

export interface BTCTransaction {
  vout: Array<{
    scriptpubkey: string
    value: number
  }>
}

export interface BTCInput {
  txid: string
  vout: number
  value: number
  scriptPubKey: Buffer
  sequence?: number
}

export interface BTCOutput {
  value: number
  address?: string
  script?: Buffer
}

export type BTCTransactionRequest = {
  publicKey: string
} & (
  | {
      inputs: BTCInput[]
      outputs: BTCOutput[]
      from?: never
      to?: never
      value?: never
    }
  | {
      inputs?: never
      outputs?: never
      from: string
      to: string
      value: string
    }
)

export interface BTCUnsignedTransaction {
  psbt: bitcoin.Psbt
  publicKey: string
}

export type BTCNetworkIds = 'mainnet' | 'testnet' | 'regtest'
