# Multichain Tools

A TypeScript library for handling multi-chain transactions and signatures using MPC (Multi-Party Computation).

## Overview

This library provides a unified interface for interacting with different blockchain networks, including:

- EVM-based chains (Ethereum, etc.)
- Bitcoin
- Cosmos-based chains

## Core Features

### Chain Interface

The library implements a common interface for all supported chains with the following key functionalities:

- **Balance Checking**: Query account balances across different chains
- **Address Derivation**: Derive addresses and public keys using MPC
- **Transaction Management**: Create, store, and retrieve transactions
- **Signature Handling**: Process MPC signatures for transactions
- **Transaction Broadcasting**: Submit signed transactions to the network

### Chain Signature Contract

The ChainSignatureContract is a crucial component that handles MPC operations. Here's an example implementation using NEAR:

```typescript
import { ChainSignatureContract } from './chains/ChainSignatureContract'
import { ChainSignaturesContract } from './utils/near/contract'

// Initialize with view-only access
const viewOnlyContract = new ChainSignaturesContract({
  networkId: 'testnet',
  contractId: 'contract.testnet',
})

// Initialize with full access (for signing)
const fullAccessContract = new ChainSignaturesContract({
  networkId: 'testnet',
  contractId: 'contract.testnet',
  accountId: 'signer.testnet',
  keypair: nearKeyPair, // Your NEAR KeyPair instance
})

// Example: Derive a public key
const publicKey = await fullAccessContract.getDerivedPublicKey({
  path: 'my-derivation-path',
  predecessor: 'signer.testnet',
})

// Example: Sign a payload
const signature = await fullAccessContract.sign({
  payload: [
    1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21,
    22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32,
  ], // Your payload bytes
  path: 'my-derivation-path',
  key_version: 1,
})

// Example: Get current signature deposit
const deposit = await fullAccessContract.getCurrentSignatureDeposit()
```

### Supported Chains

The library currently supports multiple blockchain networks through dedicated implementations:

- **EVM Chains**: Ethereum and compatible networks
- **Bitcoin**: Bitcoin network support
- **Cosmos**: Cosmos-based blockchain networks

## Installation

```bash
npm install multichain-tools
# or
yarn add multichain-tools
# or
pnpm add multichain-tools
```

## Usage

### Basic Example

```typescript
import { Chain } from './src/chains/Chain'

// Example implementation will depend on the specific chain being used
// See individual chain documentation for detailed examples
```

### Chain-Specific Documentation

- [EVM Chains](src/chains/EVM/README.md)
- [Bitcoin](src/chains/Bitcoin/README.md)
- [Cosmos](src/chains/Cosmos/README.md)

## Architecture

The library is built around a core `Chain` interface that defines common functionality across all supported blockchain networks. Each specific chain implementation extends this interface with network-specific features while maintaining a consistent API.

### Key Components

- **Chain Interface**: Defines standard methods for cross-chain compatibility
- **Chain-Specific Implementations**: Custom implementations for each supported blockchain
- **MPC Integration**: Secure signature generation using Multi-Party Computation
- **Transaction Management**: Unified transaction handling across chains

## Contributing

Contributions are welcome! Please read our contributing guidelines for details on our code of conduct and the process for submitting pull requests.

## License

This project is licensed under the terms specified in the [LICENSE](LICENSE) file.
