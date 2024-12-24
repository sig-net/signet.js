# EVM Chain Implementation

This directory contains the implementation of the Chain interface for EVM-compatible networks (Ethereum, Binance Smart Chain, Polygon, etc.).

## Configuration

```typescript
import { EVM } from './chains/EVM'
import { ChainSignatureContract } from './chains/ChainSignatureContract'

// Initialize the chain
const evmChain = new EVM({
  rpcUrl: 'https://mainnet.infura.io/v3/YOUR-PROJECT-ID',
  contract: new ChainSignatureContract(...),
})
```

## Public Methods

### `getBalance`

```typescript
async getBalance(address: string): Promise<string>
```

Gets the native token balance of an address in ETH units. Throws an error if the balance fetch fails.

### `deriveAddressAndPublicKey`

```typescript
async deriveAddressAndPublicKey(
  predecessor: string,
  path: KeyDerivationPath
): Promise<{ address: string; publicKey: string }>
```

Derives an Ethereum address and public key from a signer ID and derivation path. The address is derived from the last 20 bytes of the keccak256 hash of the public key.

### `getMPCPayloadAndTransaction`

```typescript
async getMPCPayloadAndTransaction(
  transactionRequest: EVMTransactionRequest
): Promise<{
  transaction: EVMUnsignedTransaction
  mpcPayloads: MPCPayloads
}>
```

Prepares a transaction for MPC signing. The transaction is enhanced with:

- Gas estimation
- Nonce calculation
- Chain ID
- EIP-1559 fee parameters

### `addSignature`

```typescript
addSignature(params: {
  transaction: EVMUnsignedTransaction
  mpcSignatures: RSVSignature[]
}): string
```

Adds a signature to an unsigned transaction and returns the serialized transaction. Uses ethers.js for transaction signing and serialization.

### `broadcastTx`

```typescript
async broadcastTx(txSerialized: string): Promise<string>
```

Broadcasts a signed transaction to the network and returns the transaction hash. Throws an error if the broadcast fails.

## Implementing a New EVM Chain

To add support for a new EVM-compatible chain, you only need to configure the provider URL. The chain ID and network configuration are automatically retrieved from the provider.

Example for adding new chains:

```typescript
// For Polygon (Matic)
const polygonChain = new EVM({
  rpcUrl: 'https://polygon-rpc.com',
  contract: new ChainSignatureContract(...),
})

// For Binance Smart Chain
const bscChain = new EVM({
  rpcUrl: 'https://bsc-dataseed.binance.org',
  contract: new ChainSignatureContract(...),
})

// For Arbitrum
const arbitrumChain = new EVM({
  rpcUrl: 'https://arb1.arbitrum.io/rpc',
  contract: new ChainSignatureContract(...),
})
```

The implementation uses ethers.js v6 internally and supports all standard EVM operations including EIP-1559 transactions.
