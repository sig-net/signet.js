// There is no types for coinselect
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-expect-error

import coinselect from 'coinselect'

import { BTCRpcAdapter } from '@chain-adapters/Bitcoin/BTCRpcAdapter/BTCRpcAdapter'
import {
  type BTCFeeRecommendation,
  type UTXO,
} from '@chain-adapters/Bitcoin/BTCRpcAdapter/Mempool/types'
import type {
  BTCTransaction,
  BTCInput,
  BTCOutput,
} from '@chain-adapters/Bitcoin/types'

export class Mempool extends BTCRpcAdapter {
  private readonly providerUrl: string

  constructor(providerUrl: string) {
    super()
    this.providerUrl = providerUrl
  }

  private async fetchFeeRate(confirmationTarget = 6): Promise<number> {
    const response = await fetch(`${this.providerUrl}/v1/fees/recommended`)
    const data = (await response.json()) as BTCFeeRecommendation

    if (confirmationTarget <= 1) {
      return data.fastestFee
    } else if (confirmationTarget <= 3) {
      return data.halfHourFee
    } else if (confirmationTarget <= 6) {
      return data.hourFee
    } else {
      return data.economyFee
    }
  }

  private async fetchUTXOs(address: string): Promise<UTXO[]> {
    try {
      const response = await fetch(
        `${this.providerUrl}/address/${address}/utxo`
      )
      return (await response.json()) as UTXO[]
    } catch (error) {
      console.error('Failed to fetch UTXOs:', error)
      return []
    }
  }

  async selectUTXOs(
    from: string,
    targets: BTCOutput[],
    confirmationTarget = 6
  ): Promise<{ inputs: BTCInput[]; outputs: BTCOutput[] }> {
    const utxos = await this.fetchUTXOs(from)
    const feeRate = await this.fetchFeeRate(confirmationTarget)

    // Add a small amount to the fee rate to ensure the transaction is confirmed
    const ret = coinselect(utxos, targets, Math.ceil(feeRate + 1))

    if (!ret.inputs || !ret.outputs) {
      throw new Error(
        'Invalid transaction: coinselect failed to find a suitable set of inputs and outputs. This could be due to insufficient funds, or no inputs being available that meet the criteria.'
      )
    }

    return {
      inputs: ret.inputs,
      outputs: ret.outputs,
    }
  }

  async broadcastTransaction(transactionHex: string): Promise<string> {
    const response = await fetch(`${this.providerUrl}/tx`, {
      method: 'POST',
      body: transactionHex,
    })

    if (response.ok) {
      return await response.text()
    }

    throw new Error(`Failed to broadcast transaction: ${await response.text()}`)
  }

  async getBalance(address: string): Promise<number> {
    const response = await fetch(`${this.providerUrl}/address/${address}`)
    const data = (await response.json()) as {
      chain_stats: { funded_txo_sum: number; spent_txo_sum: number }
    }
    return data.chain_stats.funded_txo_sum - data.chain_stats.spent_txo_sum
  }

  async getTransaction(txid: string): Promise<BTCTransaction> {
    const response = await fetch(`${this.providerUrl}/tx/${txid}`)
    return (await response.json()) as BTCTransaction
  }
}
