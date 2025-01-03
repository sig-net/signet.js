# Bitcoin Chain Implementation

This implementation supports both Bitcoin mainnet and testnet, with a focus on P2WPKH (Native SegWit) transactions.

## Configuration

```ts twoslash
import { Bitcoin, BTCRpcAdapters, near } from 'signet.js'

// Initialize the RPC adapter using Mempool
const btcRPCAdapter = new BTCRpcAdapters.Mempool('https://mempool.space/api')

// Initialize the chain
const bitcoinChain = new Bitcoin({
  network: 'testnet',
  contract: new near.contract.ChainSignaturesContract({
    networkId: 'testnet',
    contractId: 'v1.chain-signatures.testnet',
  }),
  btcRpcAdapter: btcRPCAdapter,
})
```

## RPC Adapter

The `BTCRpcAdapter` provides an abstraction layer for interacting with Bitcoin nodes or APIs. It handles:

- UTXO selection and management using coinselect
- Balance queries
- Transaction broadcasting
- Fee estimation

### Custom Adapter Implementation

You can implement your own adapter by extending the `BTCRpcAdapter` abstract class:

```typescript
// [!include ~/../src/chains/Bitcoin/BTCRpcAdapter/BTCRpcAdapter.ts]
```

## Public Methods

### getBalance

Gets the BTC balance of an address.

```typescript
async getBalance(address: string): Promise<string>
```

**Parameters:**

- `address`: The Bitcoin address to check

**Returns:**

- The balance in BTC as a string

### deriveAddressAndPublicKey

Derives a Bitcoin address and public key.

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
  - `address`: The derived Bitcoin address (P2WPKH)
  - `publicKey`: The corresponding public key (compressed)

**Throws:**

- Error if public key derivation or address generation fails

### getMPCPayloadAndTransaction

Prepares a transaction for MPC signing.

```typescript
async getMPCPayloadAndTransaction(
  transactionRequest: BTCTransactionRequest
): Promise<{
  transaction: BTCUnsignedTransaction
  mpcPayloads: MPCPayloads
}>
```

The process includes:

- UTXO selection (if not provided)
- Fee calculation
- PSBT creation
- Signing payload generation

### addSignature

Adds signatures to a PSBT.

```typescript
addSignature(params: {
  transaction: BTCUnsignedTransaction
  mpcSignatures: RSVSignature[]
}): string
```

**Parameters:**

- `transaction`: The unsigned transaction with PSBT
- `mpcSignatures`: Array of RSV signatures from MPC

**Returns:**

- The serialized signed transaction

### broadcastTx

Broadcasts a signed transaction.

```typescript
async broadcastTx(txSerialized: string): Promise<string>
```

**Parameters:**

- `txSerialized`: The serialized transaction in hex format

**Returns:**

- The transaction ID (txid)

## Technical Details

The implementation:

- Uses bitcoinjs-lib internally
- Supports P2WPKH (Native SegWit) addresses
- Handles UTXO management
- Supports custom fee rates
- Uses PSBT for transaction construction
- Supports both mainnet and testnet
