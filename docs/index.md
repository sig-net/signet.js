# Multichain Tools

A TypeScript library for handling multi-chain transactions and signatures using MPC (Multi-Party Computation).

## Overview

This library provides a unified interface for interacting with different blockchain networks through a common set of methods. It uses MPC for secure key management and transaction signing.

## Supported Chains

- [EVM Chains](/chains/evm) - Ethereum and compatible networks
- [Bitcoin](/chains/bitcoin) - Bitcoin network support
- [Cosmos](/chains/cosmos) - Cosmos-based blockchain networks

## Core Features

- **Unified Interface**: Common methods for all supported chains
- **MPC Integration**: Secure key management and signing
- **Modular Design**: Easy to extend for new chains
- **Type Safety**: Full TypeScript support

## Installation

```bash
npm install multichain-tools
# or
yarn add multichain-tools
# or
pnpm add multichain-tools
```

## Quick Start

Here's a basic example using the EVM implementation:

```typescript
import { EVM } from '@multichain-tools/chains/EVM'
import { ChainSignaturesContract } from '@multichain-tools/utils/near/contract'

// Initialize the contract
const contract = new ChainSignaturesContract({
  networkId: 'testnet',
  contractId: 'mpc.testnet',
  accountId: 'signer.testnet',
  keypair: nearKeyPair,
})

// Initialize the chain
const evmChain = new EVM({
  rpcUrl: 'https://mainnet.infura.io/v3/YOUR-PROJECT-ID',
  contract,
})

// Create and sign a transaction
const { transaction, mpcPayloads } = await evmChain.getMPCPayloadAndTransaction(
  {
    to: '0x1234...',
    value: '1000000000000000000', // 1 ETH
  }
)

const signature = await contract.sign({
  payload: mpcPayloads[0].payload,
  path: 'm/44/60/0/0/0',
  key_version: 1,
})

const signedTx = evmChain.addSignature({
  transaction,
  mpcSignatures: [signature],
})

const txHash = await evmChain.broadcastTx(signedTx)
```

## Next Steps

- Learn about [MPC System](/guides/mpc-overview)
- Explore chain-specific documentation:
  - [EVM Chains](/chains/evm)
  - [Bitcoin](/chains/bitcoin)
  - [Cosmos](/chains/cosmos)
- Read the implementation guides:
  - [Creating a New Chain](/guides/implementing-new-chain)
  - [Bitcoin RPC Adapter](/guides/implementing-btc-adapter)
  - [Chain Signature Contract](/guides/implementing-signature-contract)
