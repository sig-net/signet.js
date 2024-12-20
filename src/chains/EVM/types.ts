import type * as ethers from 'ethers'

export type EVMUnsignedTransaction = ethers.TransactionLike

export type EVMTransactionRequest = Omit<ethers.TransactionLike, 'from'> & {
  from: string
}
