# Cosmos Chain Implementation

This directory contains the implementation of the Chain interface for Cosmos-based networks (Cosmos Hub, Osmosis, etc.).

## Configuration

```typescript
import { Cosmos } from './chains/Cosmos'
import { ChainSignatureContract } from './chains/ChainSignatureContract'

// Initialize the chain
const cosmosChain = new Cosmos({
  chainId: 'cosmoshub-4',
  contract: new ChainSignatureContract(...),
  endpoints: {
    rpcUrl: 'https://rpc.cosmos.network',
    restUrl: 'https://api.cosmos.network',
  },
})
```

## Public Methods

### `getBalance`

```typescript
async getBalance(address: string): Promise<string>
```

Gets the native token balance of an address in the chain's base denomination. The balance is formatted according to the chain's decimal places.

### `deriveAddressAndPublicKey`

```typescript
async deriveAddressAndPublicKey(
  predecessor: string,
  path: KeyDerivationPath
): Promise<{ address: string; publicKey: string }>
```

Derives a Cosmos address and public key from a signer ID and derivation path. The address is derived using the chain's bech32 prefix and RIPEMD160(SHA256(pubkey)) hashing.

### `getMPCPayloadAndTransaction`

```typescript
async getMPCPayloadAndTransaction(
  transactionRequest: CosmosTransactionRequest
): Promise<{
  transaction: CosmosUnsignedTransaction
  mpcPayloads: MPCPayloads
}>
```

Prepares a transaction for MPC signing. The process includes:

- Fee calculation using the chain's gas price
- Account sequence retrieval
- Message encoding using Protobuf
- AuthInfo generation with SIGN_MODE_DIRECT
- SignDoc creation and hashing

### `addSignature`

```typescript
addSignature(params: {
  transaction: CosmosUnsignedTransaction
  mpcSignatures: RSVSignature[]
}): string
```

Adds signatures to a transaction and returns the serialized transaction in hex format. Supports potential multi-sig transactions.

### `broadcastTx`

```typescript
async broadcastTx(txSerialized: string): Promise<string>
```

Broadcasts a signed transaction to the network and returns the transaction hash. Throws an error if the broadcast fails or if the transaction returns a non-zero code.

## Implementing a New Cosmos Chain

To add support for a new Cosmos SDK-based chain, you need to:

1. Add the chain ID to the `CosmosNetworkIds` type
2. Add chain configuration in the `utils.ts` file:

```typescript
// In utils.ts
export const CHAIN_INFO: Record<CosmosNetworkIds, ChainInfo> = {
  'my-new-chain': {
    prefix: 'mychain', // Bech32 address prefix
    denom: 'utoken', // Base denomination
    decimals: 6, // Token decimals
    gasPrice: 0.025, // Default gas price
    defaultGas: 200_000, // Default gas limit
  },
}
```

Example configurations for popular Cosmos chains:

```typescript
// For Osmosis
const osmosisChain = new Cosmos({
  chainId: 'osmosis-1',
  contract: new ChainSignatureContract(...),
})

// For Juno
const junoChain = new Cosmos({
  chainId: 'juno-1',
  contract: new ChainSignatureContract(...),
  endpoints: {
    rpcUrl: 'https://rpc.juno.network',
    restUrl: 'https://rest.juno.network',
  },
})
```

The implementation uses CosmJS internally and supports:

- Direct signing mode (SIGN_MODE_DIRECT)
- Protobuf message encoding
- Standard Cosmos SDK message types
- IBC transfers
- Custom messages through protobuf registration
