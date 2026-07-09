# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

Yarn 4 via corepack (`packageManager` field). Corepack ships with Node ≤ 24; on Node 25+ run `npm i -g corepack` once, then `corepack enable`.

```bash
# Build
yarn build                     # tsdown → dist/ (ESM + CJS + declarations)
yarn watch                     # tsdown --watch

# Quality — run `yarn check` and `yarn test` before reporting a task as complete
yarn check                     # typecheck + lint + format check (read-only)
yarn fix                       # auto-fix lint + format issues
yarn typecheck                 # tsc --noEmit
yarn lint                      # eslint src/**/*.ts tests/**/*.ts
yarn format                    # prettier --write .

# Run a single test file directly (when infra is already running)
yarn vitest run path/to/test.ts
```

## Testing

Each test script manages its own infrastructure (start → test → cleanup). No separate start/stop scripts needed.

### Unit tests (mocked signing, local Docker)

```bash
yarn test              # runs EVM + BTC + Cosmos sequentially
yarn test:evm          # starts hardhat on :8545, runs tests, kills hardhat
yarn test:btc          # docker compose up (bitcoind+electrs+chopsticks), runs tests, down
yarn test:cosmos       # docker build/run gaiad, waits for first block, runs tests, removes container
```

All signing is mocked with local secp256k1 — no env vars or network access needed.

### E2E tests (real MPC on Sepolia, broadcast on local Docker)

Requires `SEPOLIA_PRIVATE_KEY` and `SEPOLIA_RPC_URL` in `.env`. On-demand only, not in CI.

```bash
yarn test:evm:e2e      # MPC sign on Sepolia → broadcast on local hardhat
yarn test:btc:e2e      # MPC sign on Sepolia → broadcast on local regtest
yarn test:cosmos:e2e   # MPC sign on Sepolia → broadcast on local gaiad
```

EVM and BTC E2E tests cannot run in parallel with unit tests (port 8545 / docker conflicts).

### Integration tests (real testnets, on-demand)

```bash
yarn test:solana:integration  # sign on Solana devnet (needs SOLANA_PRIVATE_KEY)
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

The package is published to npm as the org-scoped `@sig-net/signet.js` (public access, set via
`publishConfig.access`). Publishing happens in CI via npm OIDC trusted publishing (no npm tokens;
requires the one-time trusted-publisher config on npmjs.com: package `@sig-net/signet.js` → GitHub
Actions → `sig-net/signet.js`, workflow `deploy.yaml`). Because the trusted-publisher setting lives
on the package's settings page, the package must exist first — bootstrap the very first publish with
a token (or a local `npm publish`), then configure trusted publishing for all subsequent tags. To
release:

```bash
yarn release:patch                          # or release:minor / release:major / release:beta — bumps package.json only
git commit -am "chore: release vX.Y.Z"      # land the bump on main (via PR or push)
git tag vX.Y.Z
git push origin vX.Y.Z                      # deploy.yaml runs full checks, then publishes to npm
gh release create vX.Y.Z --generate-notes   # auto-generates notes, tweak if needed
```

The deploy workflow fails if the tag doesn't match the package.json version. Prerelease versions
(`X.Y.Z-beta.N`) are published under the `beta` dist-tag automatically.

## CI

- `checks.yaml` — on PRs and pushes to main (and called by deploy): 4 parallel jobs after the `check` gate (format, lint, typecheck, build, compat): `test-evm`, `test-btc`, `test-cosmos`. E2E and integration tests are not in CI.
- `deploy.yaml` — on `vX.Y.Z` tag push: runs the full checks suite, then builds and publishes to npm via OIDC trusted publishing.
