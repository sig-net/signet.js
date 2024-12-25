# Multichain Tools Documentation

A TypeScript library for handling multi-chain transactions and signatures using MPC (Multi-Party Computation).

## Overview

This library provides a unified interface for interacting with different blockchain networks through a common set of methods. It uses MPC-TSS for secure transaction signing.

## Supported Chains

- [EVM Chains](./chains/evm.md) - Ethereum and compatible networks
- [Bitcoin](./chains/bitcoin.md) - Bitcoin network (mainnet and testnet)
- [Cosmos](./chains/cosmos.md) - Cosmos SDK-based networks

## Core Features

- **Balance Checking**: Query account balances across different chains
- **Address Derivation**: Derive addresses and public keys using MPC
- **Transaction Management**: Create, store, and retrieve transactions
- **Signature Handling**: Process MPC signatures for transactions
- **Transaction Broadcasting**: Submit signed transactions to the network

## Installation

```bash
npm install signet.js
# or
yarn add signet.js
# or
pnpm add signet.js
```

## Quick Start

Here's a basic example using the EVM implementation:

```ts twoslash
import { EVM, near } from 'signet.js'
import { KeyPair, type KeyPairString } from '@near-js/crypto'

// Initialize NEAR connection with credentials from environment
const accountId = process.env.NEAR_ACCOUNT_ID
const privateKey = process.env.NEAR_PRIVATE_KEY as KeyPairString

if (!accountId || !privateKey) {
  throw new Error(
    'NEAR_ACCOUNT_ID and NEAR_PRIVATE_KEY must be set in environment'
  )
}

const nearKeyPair = KeyPair.fromString(privateKey)

const contract = new near.contract.ChainSignaturesContract({
  networkId: 'testnet',
  contractId: 'contract.testnet',
  accountId: 'signer.testnet',
  keypair: nearKeyPair,
})

const evmChain = new EVM({
  rpcUrl: 'https://mainnet.infura.io/v3/YOUR-PROJECT-ID',
  contract,
})

// Derive address and public key
const { address, publicKey } = await evmChain.deriveAddressAndPublicKey(
  'signer.testnet',
  'my-derivation-path'
)

// Check balance
const balance = await evmChain.getBalance(address)

// Create and sign transaction
const { transaction, mpcPayloads } = await evmChain.getMPCPayloadAndTransaction(
  {
    from: '0x...',
    to: '0x...',
    value: '1000000000000000000', // 1 ETH
  }
)

// Sign with MPC
const signature = await contract.sign({
  payload: mpcPayloads[0].payload,
  path: 'any_string',
  key_version: 0,
})

// Add signature
const signedTx = evmChain.addSignature({
  transaction,
  mpcSignatures: [signature],
})

// Broadcast transaction
const txHash = await evmChain.broadcastTx(signedTx)
```

## Architecture

The library is built around a core `Chain` interface that defines common functionality across all supported blockchain networks. Each specific chain implementation extends this interface with network-specific features while maintaining a consistent API.

### Key Components

- **Chain Interface**: Defines standard methods for cross-chain compatibility
- **Chain-Specific Implementations**: Custom implementations for each supported blockchain
- **MPC Integration**: Secure signature generation using Multi-Party Computation
- **Transaction Management**: Unified transaction handling across chains

## Contributing

Contributions are welcome! Please read our contributing guidelines for details on our code of conduct and the process for submitting pull requests.
