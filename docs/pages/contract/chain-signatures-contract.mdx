# Implementing a Chain Signature Contract

This guide explains how to implement a custom Chain Signature Contract for integrating with different MPC systems or signing infrastructures.

## Overview

The `ChainSignatureContract` is an abstract class that defines the interface for interacting with MPC infrastructure. It provides methods for:

- Key derivation
- Transaction signing
- Signature deposit management

## Step-by-Step Guide

### 1. Define Required Types

First, ensure you have the necessary types:

```typescript
import BN from 'bn.js'
import { RSVSignature } from '../signature'
import { UncompressedPublicKey } from './types'

interface SignArgs {
  payload: number[]
  path: string
  key_version: number
}

interface DeriveArgs {
  path: string
  predecessor: string
}
```

### 2. Implement the Contract

Create a new class that extends `ChainSignatureContract`:

```typescript
import { ChainSignatureContract } from '../ChainSignatureContract'

export class CustomSignatureContract extends ChainSignatureContract {
  constructor(
    private readonly config: {
      endpoint: string
      apiKey: string
    }
  ) {
    super()
  }

  async getCurrentSignatureDeposit(): Promise<BN> {
    // Implement deposit checking
    const response = await fetch(`${this.config.endpoint}/deposit`, {
      headers: this.getHeaders(),
    })

    if (!response.ok) {
      throw new Error(`Failed to get deposit: ${await response.text()}`)
    }

    const { deposit } = await response.json()
    return new BN(deposit)
  }

  async getPublicKey(): Promise<UncompressedPublicKey> {
    // Implement root public key retrieval
    const response = await fetch(`${this.config.endpoint}/public-key`, {
      headers: this.getHeaders(),
    })

    if (!response.ok) {
      throw new Error(`Failed to get public key: ${await response.text()}`)
    }

    const { publicKey } = await response.json()
    return publicKey
  }

  async sign(args: SignArgs): Promise<RSVSignature> {
    // Implement MPC signing
    const response = await fetch(`${this.config.endpoint}/sign`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(args),
    })

    if (!response.ok) {
      throw new Error(`Failed to sign: ${await response.text()}`)
    }

    const { signature } = await response.json()
    return signature
  }

  async getDerivedPublicKey(args: DeriveArgs): Promise<UncompressedPublicKey> {
    // Implement key derivation
    const response = await fetch(`${this.config.endpoint}/derive`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(args),
    })

    if (!response.ok) {
      throw new Error(`Failed to derive key: ${await response.text()}`)
    }

    const { publicKey } = await response.json()
    return publicKey
  }

  private getHeaders(): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${this.config.apiKey}`,
    }
  }
}
```

### 3. Implement Error Handling

Add proper error handling:

```typescript
class SignatureContractError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly httpStatus?: number
  ) {
    super(message)
    this.name = 'SignatureContractError'
  }
}

// Helper method for response handling
private async handleResponse<T>(
  response: Response,
  errorContext: string
): Promise<T> {
  if (!response.ok) {
    throw new SignatureContractError(
      `${errorContext}: ${await response.text()}`,
      'API_ERROR',
      response.status
    )
  }

  return await response.json()
}
```

### 4. Add Caching (Optional)

Implement caching for derived public keys:

```typescript
export class CachedSignatureContract extends CustomSignatureContract {
  private readonly keyCache = new Map<string, UncompressedPublicKey>()

  async getDerivedPublicKey(args: DeriveArgs): Promise<UncompressedPublicKey> {
    const cacheKey = `${args.predecessor}:${args.path}`
    const cached = this.keyCache.get(cacheKey)
    if (cached) return cached

    const publicKey = await super.getDerivedPublicKey(args)
    this.keyCache.set(cacheKey, publicKey)
    return publicKey
  }
}
```

## Example Usage

### 1. Basic Usage

```typescript
// Initialize the contract
const contract = new CustomSignatureContract({
  endpoint: 'https://mpc-service.example.com',
  apiKey: 'your-api-key',
})

// Use in chain implementation
const evmChain = new EVM({
  rpcUrl: 'https://ethereum-rpc.com',
  contract,
})
```

### 2. With Caching

```typescript
const contract = new CachedSignatureContract({
  endpoint: 'https://mpc-service.example.com',
  apiKey: 'your-api-key',
})
```

### 3. Direct Usage

```typescript
// Get deposit requirement
const deposit = await contract.getCurrentSignatureDeposit()

// Derive a public key
const publicKey = await contract.getDerivedPublicKey({
  path: 'm/44/60/0/0/0',
  predecessor: 'user.example.com',
})

// Sign a payload
const signature = await contract.sign({
  payload: [1, 2, 3],
  path: 'm/44/60/0/0/0',
  key_version: 1,
})
```

## Testing

Create comprehensive tests:

```typescript
describe('CustomSignatureContract', () => {
  let contract: CustomSignatureContract
  let mockFetch: jest.Mock

  beforeEach(() => {
    mockFetch = jest.fn()
    global.fetch = mockFetch
    contract = new CustomSignatureContract({
      endpoint: 'https://test.api',
      apiKey: 'test-key',
    })
  })

  describe('sign', () => {
    it('should return signature', async () => {
      const mockSignature = {
        r: '1234',
        s: '5678',
        v: 27,
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ signature: mockSignature }),
      })

      const signature = await contract.sign({
        payload: [1, 2, 3],
        path: 'm/44/60/0/0/0',
        key_version: 1,
      })

      expect(signature).toEqual(mockSignature)
    })

    it('should handle errors', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        text: () => Promise.resolve('API Error'),
      })

      await expect(
        contract.sign({
          payload: [1, 2, 3],
          path: 'm/44/60/0/0/0',
          key_version: 1,
        })
      ).rejects.toThrow()
    })
  })
})
```

## Best Practices

1. **Error Handling**:

   - Use specific error types
   - Include error codes
   - Provide detailed error messages

2. **Performance**:

   - Implement caching where appropriate
   - Use connection pooling
   - Handle rate limiting

3. **Security**:

   - Validate all inputs
   - Use secure communication
   - Implement proper authentication

4. **Monitoring**:
   - Log important operations
   - Track performance metrics
   - Monitor error rates
