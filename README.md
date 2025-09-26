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

## Quick Example (EVM)

```ts twoslash
import { chainAdapters, contracts } from 'signet.js'
import { createPublicClient, http } from 'viem'
import { mainnet } from 'viem/chains'

const publicClient = createPublicClient({
  chain: mainnet,
  transport: http(),
})

// Assume you already instantiated your ChainSignatures EVM contract wrapper
const contract = new contracts.evm.ChainSignaturesContract({
  contractAddress: '0xYourContractAddress' as `0x${string}`,
  walletClient: /* your WalletClient */ undefined as any,
})

const evmChain = new chainAdapters.evm.EVM({
  publicClient,
  contract,
})

// Derive address and public key for a predecessor identifier
const predecessorId = '0xYourEOAOrContract'
const { address, publicKey } = await evmChain.deriveAddressAndPublicKey(
  predecessorId,
  'any_string'
)

// Check balance
const { balance, decimals } = await evmChain.getBalance(address)

// Create and sign transaction
const { transaction, hashesToSign } =
  await evmChain.prepareTransactionForSigning({
    from: address,
    to: '0x...',
    value: 1n,
  })

// Request MPC signature
const rsvSignature = await contract.sign({
  payload: hashesToSign[0],
  path: 'any_string',
  key_version: 0,
})

// Finalize and broadcast
const signedTx = evmChain.finalizeTransactionSigning({
  transaction,
  rsvSignatures: [rsvSignature],
})

const txHash = await evmChain.broadcastTx(signedTx)
```

## Documentation

For detailed documentation, including:

- Getting started guide
- Chain-specific implementations
- MPC system overview
- Implementation guides
- API reference

Visit our [documentation site](https://docs.sig.network/).
