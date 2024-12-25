# Cosmos Chain Implementation

This implementation supports Cosmos SDK-based networks (Cosmos Hub, Osmosis, etc.) with a focus on standard transactions and IBC transfers.

## Configuration

```typescript
import { Cosmos } from '@multichain-tools/chains/Cosmos'
import { ChainSignatureContract } from '@multichain-tools/chains/ChainSignatureContract'

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

### getBalance

Gets the native token balance of an address.

```typescript
async getBalance(address: string): Promise<string>
```

**Parameters:**

- `address`: The Cosmos address to check

**Returns:**

- The balance formatted according to the chain's decimal places

**Throws:**

- Error if balance fetch fails

### deriveAddressAndPublicKey

Derives a Cosmos address and public key.

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
  - `address`: The derived Cosmos address (bech32)
  - `publicKey`: The corresponding public key

**Throws:**

- Error if public key derivation fails

### getMPCPayloadAndTransaction

Prepares a transaction for MPC signing.

```typescript
async getMPCPayloadAndTransaction(
  transactionRequest: CosmosTransactionRequest
): Promise<{
  transaction: CosmosUnsignedTransaction
  mpcPayloads: MPCPayloads
}>
```

The process includes:

- Fee calculation using the chain's gas price
- Account sequence retrieval
- Message encoding using Protobuf
- AuthInfo generation with SIGN_MODE_DIRECT
- SignDoc creation and hashing

### addSignature

Adds signatures to a transaction.

```typescript
addSignature(params: {
  transaction: CosmosUnsignedTransaction
  mpcSignatures: RSVSignature[]
}): string
```

**Parameters:**

- `transaction`: The unsigned transaction
- `mpcSignatures`: Array of RSV signatures from MPC

**Returns:**

- The serialized signed transaction in hex format

### broadcastTx

Broadcasts a signed transaction.

```typescript
async broadcastTx(txSerialized: string): Promise<string>
```

**Parameters:**

- `txSerialized`: The serialized transaction in hex format

**Returns:**

- The transaction hash

**Throws:**

- Error if broadcast fails or transaction returns non-zero code

## Adding New Cosmos Chains

To add support for a new Cosmos SDK-based chain:

1. Add the chain ID to the `CosmosNetworkIds` type
2. Add chain configuration:

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

Example configurations:

```typescript
// For Osmosis
const osmosisChain = new Cosmos({
  chainId: 'osmosis-1',
  contract: new ChainSignatureContract(...),
  endpoints: {
    rpcUrl: 'https://rpc.osmosis.zone',
    restUrl: 'https://lcd.osmosis.zone',
  },
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

## Technical Details

The implementation:

- Uses CosmJS internally
- Supports SIGN_MODE_DIRECT
- Uses Protobuf for message encoding
- Supports standard Cosmos SDK messages:
  - Bank (Send, MultiSend)
  - Staking (Delegate, Undelegate, Redelegate)
  - Distribution (Withdraw Rewards)
  - IBC (Transfer)
- Allows custom message registration
