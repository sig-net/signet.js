# Implementing a New Chain

This guide explains how to implement support for a new blockchain network in the multichain-tools library.

## Overview

To add support for a new blockchain, you need to implement the `Chain` interface. This interface provides a standard set of methods that all chain implementations must support.

## Step-by-Step Guide

### 1. Create the Chain Types

First, define the transaction types for your chain:

```typescript
// types.ts
export interface MyChainTransactionRequest {
  to: string
  value: string
  // Add other chain-specific fields
}

export interface MyChainUnsignedTransaction {
  raw: Uint8Array
  publicKey: string
  // Add other chain-specific fields
}
```

### 2. Implement the Chain Interface

Create a new class that implements the `Chain` interface:

```typescript
import { Chain } from '../Chain'
import { ChainSignatureContract } from '../ChainSignatureContract'
import { KeyDerivationPath, RSVSignature } from '../../signature/types'
import { MPCPayloads } from '../types'
import { MyChainTransactionRequest, MyChainUnsignedTransaction } from './types'

export class MyChain
  implements Chain<MyChainTransactionRequest, MyChainUnsignedTransaction>
{
  private readonly contract: ChainSignatureContract

  constructor(config: {
    contract: ChainSignatureContract
    // Add other configuration options
  }) {
    this.contract = config.contract
    // Initialize other dependencies
  }

  async getBalance(address: string): Promise<string> {
    // Implement balance checking
    // Should return balance in the chain's base unit
  }

  async deriveAddressAndPublicKey(
    signerId: string,
    path: KeyDerivationPath
  ): Promise<{ address: string; publicKey: string }> {
    // Get the public key from MPC
    const publicKey = await this.contract.getDerivedPublicKey({
      path: path.toString(),
      predecessor: signerId,
    })

    // Convert public key to address using chain-specific method
    const address = this.publicKeyToAddress(publicKey)

    return { address, publicKey }
  }

  setTransaction(
    transaction: MyChainUnsignedTransaction,
    storageKey: string
  ): void {
    // Store transaction in localStorage
    localStorage.setItem(storageKey, JSON.stringify(transaction))
  }

  getTransaction(
    storageKey: string,
    options?: { remove?: boolean }
  ): MyChainUnsignedTransaction | undefined {
    // Retrieve transaction from localStorage
    const stored = localStorage.getItem(storageKey)
    if (!stored) return undefined

    if (options?.remove) {
      localStorage.removeItem(storageKey)
    }

    return JSON.parse(stored)
  }

  async getMPCPayloadAndTransaction(
    transactionRequest: MyChainTransactionRequest
  ): Promise<{
    transaction: MyChainUnsignedTransaction
    mpcPayloads: MPCPayloads
  }> {
    // 1. Create unsigned transaction
    const unsignedTx = await this.createUnsignedTransaction(transactionRequest)

    // 2. Generate signing payload
    const payload = this.getSigningPayload(unsignedTx)

    return {
      transaction: unsignedTx,
      mpcPayloads: [{ payload }],
    }
  }

  addSignature(params: {
    transaction: MyChainUnsignedTransaction
    mpcSignatures: RSVSignature[]
  }): string {
    const { transaction, mpcSignatures } = params

    // Apply signatures to transaction
    const signedTx = this.applySignatures(transaction, mpcSignatures)

    // Return serialized transaction
    return this.serializeTransaction(signedTx)
  }

  async broadcastTx(txSerialized: string): Promise<string> {
    // Broadcast transaction to network
    // Return transaction hash/ID
  }

  // Helper methods
  private publicKeyToAddress(publicKey: string): string {
    // Convert public key to address using chain-specific method
  }

  private async createUnsignedTransaction(
    request: MyChainTransactionRequest
  ): Promise<MyChainUnsignedTransaction> {
    // Create unsigned transaction using chain-specific method
  }

  private getSigningPayload(transaction: MyChainUnsignedTransaction): number[] {
    // Generate signing payload using chain-specific method
    // Return payload as array of numbers
  }

  private applySignatures(
    transaction: MyChainUnsignedTransaction,
    signatures: RSVSignature[]
  ): MyChainUnsignedTransaction {
    // Apply signatures using chain-specific method
  }

  private serializeTransaction(
    transaction: MyChainUnsignedTransaction
  ): string {
    // Serialize transaction using chain-specific method
  }
}
```

### 3. Add Network Configuration

If your chain supports multiple networks (e.g., mainnet, testnet), create a configuration type:

```typescript
// utils.ts
export type MyChainNetworkIds = 'mainnet' | 'testnet'

export interface MyChainNetworkConfig {
  rpcUrl: string
  chainId: number
  // Add other network-specific configuration
}

export const NETWORK_CONFIG: Record<MyChainNetworkIds, MyChainNetworkConfig> = {
  mainnet: {
    rpcUrl: 'https://my-chain-mainnet.example.com',
    chainId: 1,
  },
  testnet: {
    rpcUrl: 'https://my-chain-testnet.example.com',
    chainId: 2,
  },
}
```

## Best Practices

1. **Error Handling**: Implement comprehensive error handling for network issues, invalid inputs, and chain-specific errors.

```typescript
class MyChainError extends Error {
  constructor(
    message: string,
    public readonly code: string
  ) {
    super(message)
    this.name = 'MyChainError'
  }
}

// Usage
if (!isValidAddress(address)) {
  throw new MyChainError('Invalid address format', 'INVALID_ADDRESS')
}
```

2. **Transaction Validation**: Validate transaction parameters before creating transactions.

```typescript
private validateTransactionRequest(request: MyChainTransactionRequest): void {
  if (!isValidAddress(request.to)) {
    throw new MyChainError('Invalid recipient address', 'INVALID_ADDRESS')
  }

  if (!isValidAmount(request.value)) {
    throw new MyChainError('Invalid transaction amount', 'INVALID_AMOUNT')
  }
}
```

3. **Gas/Fee Handling**: Implement proper fee estimation and management.

```typescript
private async estimateFee(
  transaction: MyChainUnsignedTransaction
): Promise<string> {
  // Implement chain-specific fee estimation
}
```

4. **Testing**: Create comprehensive tests for your implementation.

```typescript
describe('MyChain', () => {
  let chain: MyChain
  let mockContract: jest.Mocked<ChainSignatureContract>

  beforeEach(() => {
    mockContract = {
      getDerivedPublicKey: jest.fn(),
      sign: jest.fn(),
    }
    chain = new MyChain({ contract: mockContract })
  })

  it('should derive address correctly', async () => {
    mockContract.getDerivedPublicKey.mockResolvedValue('mock-public-key')
    const result = await chain.deriveAddressAndPublicKey('signer', {
      toString: () => 'path',
    })
    expect(result.address).toBeDefined()
    expect(result.publicKey).toBeDefined()
  })
})
```

## Example Usage

```typescript
// Initialize the chain
const myChain = new MyChain({
  contract: new ChainSignatureContract(...),
  network: 'mainnet',
})

// Use the chain
const { address } = await myChain.deriveAddressAndPublicKey(
  'signer.testnet',
  'my-path'
)

const balance = await myChain.getBalance(address)

const { transaction, mpcPayloads } = await myChain.getMPCPayloadAndTransaction({
  to: 'recipient-address',
  value: '1000000',
})

// Continue with signing and broadcasting...
```
