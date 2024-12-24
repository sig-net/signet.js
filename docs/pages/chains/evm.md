# EVM Chain Implementation

This implementation supports all EVM-compatible networks (Ethereum, Binance Smart Chain, Polygon, etc.).

## Configuration

```typescript
import { EVM } from '@multichain-tools/chains/EVM'
import { ChainSignatureContract } from '@multichain-tools/chains/ChainSignatureContract'

// Initialize the chain
const evmChain = new EVM({
  rpcUrl: 'https://mainnet.infura.io/v3/YOUR-PROJECT-ID',
  contract: new ChainSignatureContract(...),
})
```

## Public Methods

### getBalance

Gets the native token balance of an address in ETH units.

```typescript
async getBalance(address: string): Promise<string>
```

**Parameters:**

- `address`: The Ethereum address to check

**Returns:**

- The balance in ETH as a string

**Throws:**

- Error if the balance fetch fails

### deriveAddressAndPublicKey

Derives an Ethereum address and public key from a signer ID and derivation path.

```typescript
async deriveAddressAndPublicKey(
  predecessor: string,
  path: KeyDerivationPath
): Promise<{ address: string; publicKey: string }>
```

**Parameters:**

- `predecessor`: The ID of the signer to derive from
- `path`: The derivation path to use

**Returns:**

- Object containing:
  - `address`: The derived Ethereum address
  - `publicKey`: The corresponding public key

**Throws:**

- Error if public key derivation fails

### getMPCPayloadAndTransaction

Prepares a transaction for MPC signing.

```typescript
async getMPCPayloadAndTransaction(
  transactionRequest: EVMTransactionRequest
): Promise<{
  transaction: EVMUnsignedTransaction
  mpcPayloads: MPCPayloads
}>
```

The transaction is enhanced with:

- Gas estimation
- Nonce calculation
- Chain ID
- EIP-1559 fee parameters

### addSignature

Adds a signature to an unsigned transaction.

```typescript
addSignature(params: {
  transaction: EVMUnsignedTransaction
  mpcSignatures: RSVSignature[]
}): string
```

**Parameters:**

- `transaction`: The unsigned transaction
- `mpcSignatures`: Array of RSV signatures from MPC

**Returns:**

- The serialized signed transaction

### broadcastTx

Broadcasts a signed transaction to the network.

```typescript
async broadcastTx(txSerialized: string): Promise<string>
```

**Parameters:**

- `txSerialized`: The serialized signed transaction

**Returns:**

- The transaction hash

**Throws:**

- Error if broadcast fails

## Adding New EVM Chains

To add support for a new EVM-compatible chain, you only need to configure the provider URL. The chain ID and network configuration are automatically retrieved from the provider.

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

## Technical Details

The implementation:

- Uses ethers.js v6 internally
- Supports EIP-1559 transactions
- Handles gas estimation automatically
- Manages nonce calculation
- Supports all standard EVM operations
