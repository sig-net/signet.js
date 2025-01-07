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
import { EVM, utils } from 'signet.js'
import { KeyPair, type KeyPairString } from '@near-js/crypto'

// Initialize NEAR connection with credentials from environment
const accountId = process.env.NEAR_ACCOUNT_ID
const privateKey = process.env.NEAR_PRIVATE_KEY as KeyPairString

if (!accountId || !privateKey) {
  throw new Error(
    'NEAR_ACCOUNT_ID and NEAR_PRIVATE_KEY must be set in environment'
  )
}

const keypair = KeyPair.fromString(privateKey)

const contract = new utils.chains.near.ChainSignatureContract({
  networkId: 'testnet',
  contractId: 'v1.signer-prod.testnet',
  accountId,
  keypair,
})

const evmChain = new EVM({
  rpcUrl: 'https://mainnet.infura.io/v3/YOUR-PROJECT-ID',
  contract,
})

// Derive address and public key
const { address, publicKey } = await evmChain.deriveAddressAndPublicKey(
  accountId,
  'any_string'
)

// Check balance
const balance = await evmChain.getBalance(address)

// Create and sign transaction
const { transaction, mpcPayloads } = await evmChain.getMPCPayloadAndTransaction(
  {
    from: '0x...',
    to: '0x...',
    value: '1000000000000000000',
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

## Documentation

For detailed documentation, including:

- Getting started guide
- Chain-specific implementations
- MPC system overview
- Implementation guides
- API reference

Visit our [documentation site](https://near.github.io/signet.js).
