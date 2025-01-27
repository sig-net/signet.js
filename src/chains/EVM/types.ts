import type {
  Address,
  Hex,
  TransactionRequest,
  TypedDataDomain,
  TypedDataDefinition,
} from 'viem'

export type EVMUnsignedTransaction = TransactionRequest & {
  type: 'eip1559'
  chainId: number
}

export interface EVMTransactionRequest
  extends Omit<EVMUnsignedTransaction, 'chainId' | 'type'> {
  from: Address
}

export interface EVMMessage {
  message: string
  from: Address
}

export interface EVMTypedData extends Omit<TypedDataDefinition, 'domain'> {
  domain: TypedDataDomain
  from: Address
}

export interface EVMUserOperation {
  sender: Address
  nonce: bigint
  initCode: Hex
  callData: Hex
  callGasLimit: bigint
  verificationGasLimit: bigint
  preVerificationGas: bigint
  maxFeePerGas: bigint
  maxPriorityFeePerGas: bigint
  paymasterAndData: Hex
  signature: Hex
}
