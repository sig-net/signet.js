# Getting Started

This guide will help you get started with the signet.js library.

## Installation

Install the package using your preferred package manager:

```bash
npm install signet.js
# or
yarn add signet.js
# or
pnpm add signet.js
```

## Basic Setup

### 1. Initialize the Chain Signature Contract

First, set up the Chain Signature Contract that will handle MPC operations:

```typescript
import { ChainSignaturesContract } from '@multichain-tools/utils/near/contract'

const contract = new ChainSignaturesContract({
  networkId: 'testnet',
  contractId: 'mpc.testnet',
  accountId: 'signer.testnet',
  keypair: nearKeyPair,
})
```

### 2. Choose a Chain Implementation

Initialize the chain implementation you want to use:

```typescript
// For EVM chains
import { EVM } from '@multichain-tools/chains/EVM'

const evmChain = new EVM({
  rpcUrl: 'https://mainnet.infura.io/v3/YOUR-PROJECT-ID',
  contract,
})

// For Bitcoin
import { Bitcoin } from '@multichain-tools/chains/Bitcoin'
import { Mempool } from '@multichain-tools/chains/Bitcoin/adapters/Mempool'

const btcAdapter = new Mempool('https://mempool.space/api')
const bitcoinChain = new Bitcoin({
  network: 'mainnet',
  contract,
  btcRpcAdapter: btcAdapter,
})

// For Cosmos
import { Cosmos } from '@multichain-tools/chains/Cosmos'

const cosmosChain = new Cosmos({
  chainId: 'cosmoshub-4',
  contract,
  endpoints: {
    rpcUrl: 'https://rpc.cosmos.network',
    restUrl: 'https://api.cosmos.network',
  },
})
```

## Basic Operations

### 1. Derive Addresses

```typescript
// Derive an address for any chain
const { address, publicKey } = await chain.deriveAddressAndPublicKey(
  'signer.testnet',
  'm/44/60/0/0/0' // Use appropriate path for each chain
)
```

### 2. Check Balances

```typescript
const balance = await chain.getBalance(address)
console.log(`Balance: ${balance}`)
```

### 3. Create and Sign Transactions

```typescript
// 1. Create transaction
const { transaction, mpcPayloads } = await chain.getMPCPayloadAndTransaction({
  to: recipientAddress,
  value: '1000000000000000000', // 1 ETH (for EVM)
})

// 2. Sign with MPC
const signature = await contract.sign({
  payload: mpcPayloads[0].payload,
  path: 'm/44/60/0/0/0',
  key_version: 1,
})

// 3. Add signature and broadcast
const signedTx = chain.addSignature({
  transaction,
  mpcSignatures: [signature],
})

const txHash = await chain.broadcastTx(signedTx)
console.log(`Transaction hash: ${txHash}`)
```

## Chain-Specific Examples

### EVM Example

```typescript
// Send ETH
const { transaction, mpcPayloads } = await evmChain.getMPCPayloadAndTransaction(
  {
    to: '0x1234...',
    value: '1000000000000000000', // 1 ETH
    gasLimit: '21000',
  }
)
```

### Bitcoin Example

```typescript
// Send BTC
const { transaction, mpcPayloads } =
  await bitcoinChain.getMPCPayloadAndTransaction({
    outputs: [
      {
        address: 'bc1...',
        value: 100000, // 0.001 BTC in satoshis
      },
    ],
  })
```

### Cosmos Example

```typescript
// Send ATOM
const { transaction, mpcPayloads } =
  await cosmosChain.getMPCPayloadAndTransaction({
    messages: [
      {
        typeUrl: '/cosmos.bank.v1beta1.MsgSend',
        value: {
          fromAddress: senderAddress,
          toAddress: recipientAddress,
          amount: [
            {
              denom: 'uatom',
              amount: '1000000', // 1 ATOM
            },
          ],
        },
      },
    ],
  })
```

## Next Steps

- Learn about [MPC System](./mpc-overview.md)
- Explore chain-specific documentation:
  - [EVM Chains](../chains/evm.md)
  - [Bitcoin](../chains/bitcoin.md)
  - [Cosmos](../chains/cosmos.md)
- Read the implementation guides:
  - [Creating a New Chain](./implementing-new-chain.md)
  - [Bitcoin RPC Adapter](./implementing-btc-adapter.md)
  - [Chain Signature Contract](./implementing-signature-contract.md)
