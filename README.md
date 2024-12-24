# Multichain Tools

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
npm install multichain-tools
# or
yarn add multichain-tools
# or
pnpm add multichain-tools
```

## Quick Example

```typescript
import { EVM } from '@multichain-tools/chains/EVM'
import { ChainSignaturesContract } from '@multichain-tools/utils/near/contract'

// Initialize MPC contract
const contract = new ChainSignaturesContract({
  networkId: 'testnet',
  contractId: 'mpc.testnet',
  accountId: 'signer.testnet',
  keypair: nearKeyPair,
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
  path: 'm/44/60/0/0/0',
  key_version: 1,
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

Visit our [documentation site](https://near.github.io/multichain-tools).

## Contributing

Contributions are welcome! Please read our [contributing guidelines](CONTRIBUTING.md) for details on our code of conduct and the process for submitting pull requests.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
