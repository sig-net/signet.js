# Implementing a Bitcoin RPC Adapter

This guide explains how to implement a custom RPC adapter for interacting with Bitcoin nodes or services.

## Overview

The `BTCRpcAdapter` provides an abstraction layer for Bitcoin-specific operations like UTXO management, balance queries, and transaction broadcasting. You might want to implement a custom adapter when:

- Using a different Bitcoin node implementation
- Integrating with a specific blockchain service
- Adding support for custom transaction types
- Implementing specialized UTXO selection strategies

## Step-by-Step Guide

### 1. Define the Required Types

First, ensure you have the necessary types defined:

```typescript
interface BTCInput {
  txid: string
  vout: number
  value: number
  address: string
  scriptPubKey: string
}

interface BTCOutput {
  address: string
  value: number
}

interface BTCTransaction {
  txid: string
  vout: Array<{
    scriptpubkey: string
    value: number
  }>
}
```

### 2. Implement the BTCRpcAdapter

Create a new class that extends the `BTCRpcAdapter` abstract class:

```typescript
import { BTCRpcAdapter } from '../BTCRpcAdapter'
import { BTCInput, BTCOutput, BTCTransaction } from '../types'

export class CustomBTCAdapter extends BTCRpcAdapter {
  constructor(
    private readonly config: {
      url: string
      apiKey?: string
    }
  ) {
    super()
  }

  async getBalance(address: string): Promise<number> {
    // Implement balance fetching
    const response = await fetch(
      `${this.config.url}/address/${address}/balance`,
      {
        headers: this.getHeaders(),
      }
    )

    if (!response.ok) {
      throw new Error(`Failed to fetch balance: ${await response.text()}`)
    }

    const data = await response.json()
    return data.balance // Return balance in satoshis
  }

  async getTransaction(txid: string): Promise<BTCTransaction> {
    // Implement transaction fetching
    const response = await fetch(`${this.config.url}/tx/${txid}`, {
      headers: this.getHeaders(),
    })

    if (!response.ok) {
      throw new Error(`Failed to fetch transaction: ${await response.text()}`)
    }

    return await response.json()
  }

  async selectUTXOs(
    from: string,
    outputs: BTCOutput[],
    confirmationTarget = 6
  ): Promise<{
    inputs: BTCInput[]
    outputs: BTCOutput[]
  }> {
    // 1. Fetch available UTXOs
    const utxos = await this.fetchUTXOs(from)

    // 2. Get current fee rate
    const feeRate = await this.getFeeRate(confirmationTarget)

    // 3. Use coinselect for UTXO selection
    const { inputs, outputs } = coinselect(utxos, outputs, feeRate)

    if (!inputs || !outputs) {
      throw new Error('Failed to select UTXOs')
    }

    return { inputs, outputs }
  }

  async broadcastTransaction(txHex: string): Promise<string> {
    // Implement transaction broadcasting
    const response = await fetch(`${this.config.url}/tx`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: txHex,
    })

    if (!response.ok) {
      throw new Error(
        `Failed to broadcast transaction: ${await response.text()}`
      )
    }

    return await response.text() // Return txid
  }

  // Helper methods
  private getHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    }

    if (this.config.apiKey) {
      headers['Authorization'] = `Bearer ${this.config.apiKey}`
    }

    return headers
  }

  private async fetchUTXOs(address: string): Promise<BTCInput[]> {
    const response = await fetch(`${this.config.url}/address/${address}/utxo`, {
      headers: this.getHeaders(),
    })

    if (!response.ok) {
      throw new Error(`Failed to fetch UTXOs: ${await response.text()}`)
    }

    return await response.json()
  }

  private async getFeeRate(confirmationTarget: number): Promise<number> {
    const response = await fetch(`${this.config.url}/fees/recommended`, {
      headers: this.getHeaders(),
    })

    if (!response.ok) {
      throw new Error(`Failed to fetch fee rate: ${await response.text()}`)
    }

    const fees = await response.json()
    return fees[`${confirmationTarget}BlockFee`]
  }
}
```

### 3. Implement Error Handling

Add proper error handling for your adapter:

```typescript
class BTCAdapterError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly httpStatus?: number
  ) {
    super(message)
    this.name = 'BTCAdapterError'
  }
}

// Usage in adapter methods
private async handleResponse<T>(
  response: Response,
  errorContext: string
): Promise<T> {
  if (!response.ok) {
    throw new BTCAdapterError(
      `${errorContext}: ${await response.text()}`,
      'API_ERROR',
      response.status
    )
  }

  return await response.json()
}
```

### 4. Add UTXO Selection Strategy

Implement a custom UTXO selection strategy if needed:

```typescript
interface UTXOSelectionStrategy {
  select(
    utxos: BTCInput[],
    outputs: BTCOutput[],
    feeRate: number
  ): {
    inputs: BTCInput[]
    outputs: BTCOutput[]
  }
}

class LargestFirstStrategy implements UTXOSelectionStrategy {
  select(
    utxos: BTCInput[],
    outputs: BTCOutput[],
    feeRate: number
  ): {
    inputs: BTCInput[]
    outputs: BTCOutput[]
  } {
    // Sort UTXOs by value (largest first)
    const sortedUtxos = [...utxos].sort((a, b) => b.value - a.value)

    // Implement selection logic
    // ...

    return { inputs, outputs }
  }
}
```

## Example Usage

```typescript
// Initialize the adapter
const btcAdapter = new CustomBTCAdapter({
  url: 'https://api.bitcoin-service.com',
  apiKey: 'your-api-key',
})

// Use in Bitcoin chain implementation
const bitcoinChain = new Bitcoin({
  network: 'mainnet',
  contract: new ChainSignatureContract(...),
  btcRpcAdapter: btcAdapter,
})

// Direct usage
const balance = await btcAdapter.getBalance('bc1...')

const { inputs, outputs } = await btcAdapter.selectUTXOs(
  'bc1...',
  [{ address: 'bc1...', value: 100000 }]
)

const txid = await btcAdapter.broadcastTransaction(signedTxHex)
```

## Testing

Create comprehensive tests for your adapter:

```typescript
describe('CustomBTCAdapter', () => {
  let adapter: CustomBTCAdapter
  let mockFetch: jest.Mock

  beforeEach(() => {
    mockFetch = jest.fn()
    global.fetch = mockFetch
    adapter = new CustomBTCAdapter({
      url: 'https://test.api',
      apiKey: 'test-key',
    })
  })

  describe('getBalance', () => {
    it('should return balance in satoshis', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ balance: 100000 }),
      })

      const balance = await adapter.getBalance('bc1...')
      expect(balance).toBe(100000)
    })

    it('should handle errors', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        text: () => Promise.resolve('API Error'),
      })

      await expect(adapter.getBalance('bc1...')).rejects.toThrow()
    })
  })
})
```
