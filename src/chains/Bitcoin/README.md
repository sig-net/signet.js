# Bitcoin Chain Implementation

This directory contains the implementation of the Chain interface for the Bitcoin network.

## Configuration

```typescript
import { Bitcoin } from './chains/Bitcoin'
import { Mempool } from './chains/Bitcoin/adapters/Mempool/Mempool'
import { ChainSignatureContract } from './chains/ChainSignatureContract'

// Initialize the RPC adapter using Mempool
const btcAdapter = new Mempool(
  'https://mempool.space/api' // or 'https://mempool.space/testnet/api' for testnet
)

// Initialize the chain
const bitcoinChain = new Bitcoin({
  network: 'mainnet', // or 'testnet'
  contract: new ChainSignatureContract(...),
  btcRpcAdapter: btcAdapter,
})
```

## RPC Adapter

The `BTCRpcAdapter` provides an abstraction layer for interacting with Bitcoin nodes or APIs. It handles:

- UTXO selection and management using coinselect
- Balance queries
- Transaction broadcasting
- Fee estimation

### Implementing a Custom Adapter

You can implement your own adapter by extending the `BTCRpcAdapter` abstract class:

```typescript
export abstract class BTCRpcAdapter {
  abstract getBalance(address: string): Promise<number>
  abstract getTransaction(txid: string): Promise<BTCTransaction>
  abstract selectUTXOs(
    from: string,
    outputs: BTCOutput[]
  ): Promise<{
    inputs: BTCInput[]
    outputs: BTCOutput[]
  }>
  abstract broadcastTransaction(transactionHex: string): Promise<string>
}
```

Example implementation using Mempool API:

```typescript
export class Mempool extends BTCRpcAdapter {
  private readonly providerUrl: string

  constructor(providerUrl: string) {
    super()
    this.providerUrl = providerUrl
  }

  async getBalance(address: string): Promise<number> {
    const response = await fetch(`${this.providerUrl}/address/${address}`)
    const data = await response.json()
    return data.chain_stats.funded_txo_sum - data.chain_stats.spent_txo_sum
  }

  async getTransaction(txid: string): Promise<BTCTransaction> {
    const response = await fetch(`${this.providerUrl}/tx/${txid}`)
    return await response.json()
  }

  async selectUTXOs(
    from: string,
    targets: BTCOutput[],
    confirmationTarget = 6
  ): Promise<{ inputs: BTCInput[]; outputs: BTCOutput[] }> {
    const utxos = await this.fetchUTXOs(from)
    const feeRate = await this.fetchFeeRate(confirmationTarget)

    // Add a small amount to the fee rate to ensure the transaction is confirmed
    const ret = coinselect(utxos, targets, Math.ceil(feeRate + 1))

    if (!ret.inputs || !ret.outputs) {
      throw new Error(
        'Invalid transaction: coinselect failed to find a suitable set of inputs and outputs.'
      )
    }

    return {
      inputs: ret.inputs,
      outputs: ret.outputs,
    }
  }

  async broadcastTransaction(transactionHex: string): Promise<string> {
    const response = await fetch(`${this.providerUrl}/tx`, {
      method: 'POST',
      body: transactionHex,
    })

    if (response.ok) {
      return await response.text()
    }

    throw new Error(`Failed to broadcast transaction: ${await response.text()}`)
  }
}
```

## Public Methods

### `getBalance`

```typescript
async getBalance(address: string): Promise<string>
```

Gets the BTC balance of an address in BTC units.

### `deriveAddressAndPublicKey`

```typescript
async deriveAddressAndPublicKey(
  predecessor: string,
  path: KeyDerivationPath
): Promise<{ address: string; publicKey: string }>
```

Derives a Bitcoin address and public key from a signer ID and derivation path.

### `getMPCPayloadAndTransaction`

```typescript
async getMPCPayloadAndTransaction(
  transactionRequest: BTCTransactionRequest
): Promise<{
  transaction: BTCUnsignedTransaction
  mpcPayloads: MPCPayloads
}>
```

Prepares a transaction for MPC signing.

### `addSignature`

```typescript
addSignature(params: {
  transaction: BTCUnsignedTransaction
  mpcSignatures: RSVSignature[]
}): string
```

Adds signatures to a PSBT and returns the serialized transaction.

### `broadcastTx`

```typescript
async broadcastTx(txSerialized: string): Promise<string>
```

Broadcasts a signed transaction to the network.
