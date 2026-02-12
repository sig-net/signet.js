export class SignatureNotFoundError extends Error {
  public readonly requestId?: string
  public readonly hash?: string

  constructor(requestId?: string, metadata?: { hash?: string }) {
    const message = requestId
      ? `Signature not found for request ID: ${requestId}`
      : 'Signature not found'

    super(message)
    this.name = 'SignatureNotFoundError'
    this.requestId = requestId
    this.hash = metadata?.hash
  }
}

export class SigningError extends Error {
  public readonly requestId: string
  public readonly hash?: string
  public readonly originalError?: Error

  constructor(
    requestId: string,
    metadata?: { hash?: string },
    originalError?: Error
  ) {
    super(`Signing error for request ID: ${requestId}`)
    this.name = 'SigningError'
    this.requestId = requestId
    this.hash = metadata?.hash
    this.originalError = originalError
  }
}

export class ResponseError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ResponseError'
  }
}
