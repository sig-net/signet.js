import { type BTCTransaction, type BTCInput, type BTCOutput } from '../types'

export abstract class Adapter {
  abstract getInputsAndOutputs(
    from: string,
    targets: BTCOutput[]
  ): Promise<{ inputs: BTCInput[]; outputs: BTCOutput[] }>
  abstract broadcastTransaction(transactionHex: string): Promise<string>
  abstract getBalance(address: string): Promise<number>
  abstract getTransaction(txid: string): Promise<BTCTransaction>
}
