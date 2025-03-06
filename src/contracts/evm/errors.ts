import type { TransactionReceipt } from 'viem'

export class ChainSignatureError extends Error {
  requestId: `0x${string}`
  receipt: TransactionReceipt

  constructor(
    message: string,
    requestId: `0x${string}`,
    receipt: TransactionReceipt
  ) {
    super(message)
    this.name = 'ChainSignatureError'
    this.requestId = requestId
    this.receipt = receipt
  }
}

export class SignatureNotFoundError extends ChainSignatureError {
  constructor(requestId: `0x${string}`, receipt: TransactionReceipt) {
    super('Signature not found after maximum retries', requestId, receipt)
    this.name = 'SignatureNotFoundError'
  }
}

export class SignatureContractError extends ChainSignatureError {
  errorCode: string

  constructor(
    errorCode: string,
    requestId: `0x${string}`,
    receipt: TransactionReceipt
  ) {
    super(`Signature error: ${errorCode}`, requestId, receipt)
    this.name = 'SignatureContractError'
    this.errorCode = errorCode
  }
}

export class SigningError extends ChainSignatureError {
  originalError?: Error

  constructor(
    requestId: `0x${string}`,
    receipt: TransactionReceipt,
    originalError?: Error
  ) {
    super('Error signing request', requestId, receipt)
    this.name = 'SigningError'
    this.originalError = originalError
  }
}
