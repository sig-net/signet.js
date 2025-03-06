import type {
  BTCTransaction,
  BTCInput,
  BTCOutput,
} from '@chain-adapters/Bitcoin/types'

export abstract class BTCRpcAdapter {
  abstract selectUTXOs(
    from: string,
    targets: BTCOutput[]
  ): Promise<{ inputs: BTCInput[]; outputs: BTCOutput[] }>
  abstract broadcastTransaction(transactionHex: string): Promise<string>
  abstract getBalance(address: string): Promise<number>
  abstract getTransaction(txid: string): Promise<BTCTransaction>
}
