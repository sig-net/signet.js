export interface BTCFeeRecommendation {
  fastestFee: number
  halfHourFee: number
  hourFee: number
  economyFee: number
  minimumFee: number
}

interface BTCAddressStats {
  funded_txo_count: number
  funded_txo_sum: number
  spent_txo_count: number
  spent_txo_sum: number
  tx_count: number
}

export interface BTCAddressInfo {
  address: string
  chain_stats: BTCAddressStats
  mempool_stats: BTCAddressStats
}

export interface Transaction {
  txid: string
  version: number
  locktime: number
  vin: Array<{
    txid: string
    vout: number
    prevout: {
      scriptpubkey: string
      scriptpubkey_asm: string
      scriptpubkey_type: string
      scriptpubkey_address: string
      value: number
    }
    scriptsig: string
    scriptsig_asm: string
    witness: string[]
    is_coinbase: boolean
    sequence: number
  }>
  vout: Array<{
    scriptpubkey: string
    scriptpubkey_asm: string
    scriptpubkey_type: string
    scriptpubkey_address: string
    value: number
  }>
  size: number
  weight: number
  sigops?: number
  fee: number
  status: {
    confirmed: boolean
    block_height: number
    block_hash: string
    block_time: number
  }
}

export interface UTXO {
  txid: string
  vout: number
  status: {
    confirmed: boolean
    block_height: number
    block_hash: string
    block_time: number
  }
  value: number
}
