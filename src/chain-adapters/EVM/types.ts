import type {
  Address,
  TransactionRequest,
  TypedDataDefinition,
  SignableMessage,
} from 'viem'

export type EVMUnsignedTransaction = TransactionRequest & {
  type: 'eip1559'
  chainId: number
}

export interface EVMTransactionRequest extends Omit<
  EVMUnsignedTransaction,
  'chainId' | 'type'
> {
  from: Address
}

export type EVMMessage = SignableMessage

export type EVMTypedData = TypedDataDefinition
