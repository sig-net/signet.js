# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Build
pnpm build                     # tsdown → dist/ (ESM + CJS + declarations)
pnpm watch                     # tsdown --watch

# Quality — run `pnpm check` and `pnpm test` before reporting a task as complete
pnpm check                     # typecheck + lint + format check (read-only)
pnpm fix                       # auto-fix lint + format issues
pnpm typecheck                 # tsc --noEmit
pnpm lint                      # eslint src/**/*.ts tests/**/*.ts
pnpm format                    # prettier --write .

# Run a single test file directly (when infra is already running)
pnpm vitest run path/to/test.ts
```

## Testing

Each test script manages its own infrastructure (start → test → cleanup). No separate start/stop scripts needed.

### Unit tests (mocked signing, local Docker)

```bash
pnpm test              # runs EVM + BTC + Cosmos sequentially
pnpm test:evm          # starts hardhat on :8545, runs tests, kills hardhat
pnpm test:btc          # docker compose up (bitcoind+electrs+chopsticks), runs tests, down
pnpm test:cosmos       # docker build/run gaiad, waits for first block, runs tests, removes container
```

All signing is mocked with local secp256k1 — no env vars or network access needed.

### E2E tests (real MPC on Sepolia, broadcast on local Docker)

Requires `SEPOLIA_PRIVATE_KEY` and `SEPOLIA_RPC_URL` in `.env`. On-demand only, not in CI.

```bash
pnpm test:evm:e2e      # MPC sign on Sepolia → broadcast on local hardhat
pnpm test:btc:e2e      # MPC sign on Sepolia → broadcast on local regtest
pnpm test:cosmos:e2e   # MPC sign on Sepolia → broadcast on local gaiad
```

EVM and BTC E2E tests cannot run in parallel with unit tests (port 8545 / docker conflicts).

### Integration tests (real testnets, on-demand)

```bash
pnpm test:evm:integration     # sign + verify key derivation on Sepolia
pnpm test:solana:integration  # sign on Solana devnet (needs SOLANA_PRIVATE_KEY)
```

## Architecture

TypeScript library for multi-chain transactions using Signet MPC (multi-party computation) signatures. A caller never holds a private key — signing is delegated to an on-chain MPC contract.

### Signing flow (universal across all chains)

```
deriveAddressAndPublicKey(predecessor, path, keyVersion)
  → prepareTransactionForSigning(request)  → { transaction, hashesToSign }
  → contract.sign({ payload, path, key_version })  → RSVSignature
  → finalizeTransactionSigning({ transaction, rsvSignatures })  → signed tx hex
  → broadcastTx(signedTx)  → tx hash
```

### Chain Adapters (`src/chain-adapters/`)

All extend `ChainAdapter<TransactionRequest, UnsignedTransaction>` abstract base class. Each adapter handles chain-specific serialization, fee estimation, and address derivation.

- **EVM** — viem `PublicClient`, EIP-1559 transactions, message/typed-data signing. Derives address via keccak256 of uncompressed public key.
- **Bitcoin** — bitcoinjs-lib, P2WPKH only. Uses `BTCRpcAdapter` interface (Mempool-compatible REST API). UTXO selection via coinselect.
- **Cosmos** — cosmjs `StargateClient`, chain-registry for network info. Works with any Cosmos SDK chain.

### Contracts (`src/contracts/`)

Two implementations of `ChainSignatureContract` — the MPC signing interface:

- **EVM** (`contracts/evm/`) — Sends tx to Sepolia/mainnet contract, polls `SignatureRequested`/`SignatureResponded` events to retrieve RSV signature. Retry-based with configurable delay.
- **Solana** (`contracts/solana/`) — Anchor-based. Dual-layer event detection: WebSocket subscription + polling backfill for resilience.

`BaseChainSignatureContract` is the minimal interface (just `getDerivedPublicKey` + `getCurrentSignatureDeposit`). The full `ChainSignatureContract` adds `sign()` and `getPublicKey()`.

### Key types (`src/types.ts`)

- `RSVSignature` — `{ r: string, s: string, v: number }` where r/s are 64-char hex, v is 27 or 28
- `HashToSign` — `number[]` (32-byte payload passed to MPC)
- `UncompressedPubKeySEC1` — `04${string}` (uncompressed secp256k1 public key)
- `KeyDerivationPath` — string path for deterministic child key derivation

### Path aliases (tsconfig)

`@chain-adapters/*`, `@contracts/*`, `@utils/*`, `@constants`, `@types` — map to `src/` subdirectories.

### Constants (`src/constants.ts`)

Contract addresses and root public keys per environment (`TESTNET_DEV`, `TESTNET`, `MAINNET`) and chain (`ETHEREUM`, `SOLANA`). KDF chain IDs distinguish chains during key derivation (`eip155:1`, `solana:5eykt...`, `canton:global`). Canton only has a KDF chain ID — no contract addresses or root public keys (signing uses Daml templates, not on-chain contracts).

## Docker Infrastructure

- `docker/bitcoin/docker-compose.yml` — 3-service regtest stack: bitcoind (:18443) + electrs (:30000) + chopsticks (:3000, Mempool-compatible API with faucet)
- `docker/cosmos/Dockerfile` — gaiad v22 node, chain-id `cosmoshub-4`, pre-funds test address `cosmos15wgtkntdf26hqan77g0kdsldcxjddypxughytg` (derived from private key `1234567890abcdef...`) with 100B uatom

## Releasing

Every publish must have a corresponding GitHub release with a git tag:

```bash
git tag vX.Y.Z
git push origin vX.Y.Z
gh release create vX.Y.Z --generate-notes   # auto-generates notes, tweak if needed
```

## CI

4 parallel jobs after `check` gate (format, lint, typecheck, build): `test-evm`, `test-btc`, `test-cosmos`. E2E and integration tests are not in CI.
