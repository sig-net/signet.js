# Signet.js

A TypeScript library for handling multi-chain transactions and signatures using MPC (Multi-Party Computation).

## Overview

This library provides a unified interface for interacting with different blockchain networks through a common set of methods. It uses MPC for secure key management and transaction signing.

## Features

- **Multi-Chain Support**: Built-in support for EVM chains, Bitcoin, and Cosmos networks
- **Unified Interface**: Common API across all supported chains
- **MPC Integration**: Secure key management and transaction signing
- **Type Safety**: Full TypeScript support with comprehensive type definitions
- **Modular Design**: Easy to extend with new chain implementations
- **Secure**: No private keys stored or transmitted

## Installation

```bash
npm install signet.js
# or
yarn add signet.js
# or
pnpm add signet.js
```

## Quick Example

```ts twoslash
import { EVM, near } from 'signet.js'

// Initialize MPC contract
const contract = new near.contract.ChainSignaturesContract({
  networkId: 'testnet',
  contractId: 'mpc.testnet',
})

// Initialize chain
const chain = new EVM({
  rpcUrl: 'https://mainnet.infura.io/v3/YOUR-PROJECT-ID',
  contract,
})

// Create and sign transaction
const { transaction, mpcPayloads } = await chain.getMPCPayloadAndTransaction({
  to: '0x1234...',
  value: '1000000000000000000', // 1 ETH
})

const signature = await contract.sign({
  payload: mpcPayloads[0].payload,
  path: 'any_string',
  key_version: 0,
})

const signedTx = chain.addSignature({
  transaction,
  mpcSignatures: [signature],
})

const txHash = await chain.broadcastTx(signedTx)
```

## Documentation

For detailed documentation, including:

- Getting started guide
- Chain-specific implementations
- MPC system overview
- Implementation guides
- API reference

Visit our [documentation site](https://near.github.io/signet.js).
