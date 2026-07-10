# AGENTS.md

Guidance for AI coding agents and human contributors working in this repository.
It is tool-agnostic; tool-specific entrypoints (e.g. `CLAUDE.md`) should reference
this file rather than duplicate it.

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

`yarn check`/`yarn typecheck` cover the SDK (`src/`), tests, and root config files
only — the docs are type-checked separately (see [Docs](#docs)).

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

### Packaging compatibility

```bash
yarn test:compat       # attw (node16 profile) + publint --strict + CJS/ESM require+import smoke test
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

All extend the `ChainAdapter<TransactionRequest, UnsignedTransaction>` abstract base class (`ChainAdapter.ts`). Each adapter handles chain-specific serialization, fee estimation, and address derivation.

- **EVM** — viem `PublicClient`, EIP-1559 transactions, message/typed-data signing. Derives address via keccak256 of uncompressed public key.
- **Bitcoin** — bitcoinjs-lib, P2WPKH only. Uses `BTCRpcAdapter` interface (Mempool-compatible REST API). UTXO selection via coinselect.
- **Cosmos** — cosmjs `StargateClient`, chain-registry for network info. Works with any Cosmos SDK chain.

### Contracts (`src/contracts/`)

Two implementations of `ChainSignatureContract` — the MPC signing interface:

- **EVM** (`contracts/evm/`) — Sends tx to Sepolia/mainnet contract, polls `SignatureRequested`/`SignatureResponded` events to retrieve RSV signature. Retry-based with configurable delay.
- **Solana** (`contracts/solana/`) — Anchor-based. Dual-layer event detection: WebSocket subscription + polling backfill for resilience (`CpiEventParser.ts`).

`BaseChainSignatureContract` (`contracts/ChainSignatureContract.ts`) is the minimal interface (just `getDerivedPublicKey` + `getCurrentSignatureDeposit`). The full `ChainSignatureContract` adds `sign()` + `getPublicKey()`.

### Key types (`src/types.ts`)

- `RSVSignature` — `{ r: string, s: string, v: number }` where r/s are 64-char hex, v is 27 or 28
- `HashToSign` — `SignArgs['payload']`, a `number[]` (32-byte payload passed to MPC)
- `UncompressedPubKeySEC1` — `04${string}` (uncompressed secp256k1 public key); `CompressedPubKeySEC1` is `02`/`03`-prefixed
- `NajPublicKey` — `secp256k1:${Base58String}` (NEAR-style root key)
- `KeyDerivationPath` — string path for deterministic child key derivation

### Path aliases (tsconfig)

`@chain-adapters`, `@contracts`, `@utils`, `@constants`, `@types` (and their `/*` variants) — map to `src/` subdirectories.

### Constants (`src/constants.ts`)

Contract addresses and root public keys per environment (`TESTNET_DEV`, `TESTNET`, `MAINNET`) and chain (`ETHEREUM`, `SOLANA`, `CANTON`). KDF chain IDs distinguish chains during key derivation (`eip155:1`, `solana:5eykt...`, `canton:global`). Canton only has a KDF chain ID — its contract addresses and root public keys are empty (signing uses Daml templates, not on-chain contracts).

## Docs

The documentation site lives in `docs/` and is built with [vocs](https://vocs.dev)
(`docs/vocs.config.ts`). Prose pages are under `docs/pages/`; runnable, twoslash-checked
code examples are under `docs/snippets/`.

```bash
yarn docs:dev          # vocs dev server (http://localhost:5173)
yarn docs:build        # static build → docs/dist/public
yarn docs:preview      # serve the production build locally
```

Key config points in `docs/vocs.config.ts`:

- **`renderStrategy: 'full-static'`** — emits per-route static HTML so the site can be
  hosted on any static host (vocs 2.x otherwise builds a Waku SSR server bundle).
- **`basePath`** — driven by `DOCS_BASE_PATH` (defaults to `/`). GitHub Pages serves the
  project site under `/signet.js/`, so the deploy workflow sets `DOCS_BASE_PATH=/signet.js/`
  to bake that prefix into asset URLs. `logoUrl`/`iconUrl` are base-path-absolute for the
  same reason (vocs does not prefix them automatically).

Docs TypeScript (`vocs.config.ts` + snippets) is scoped by its own `docs/tsconfig.json`
(Node + DOM libs), kept separate from the browser-facing SDK typecheck — keep Node-only
APIs out of `src/`.

The site is published to GitHub Pages at **https://sig-net.github.io/signet.js/** by
`.github/workflows/docs.yaml`, which runs on version tags (see [CI](#ci)).

## Docker Infrastructure

- `docker/bitcoin/docker-compose.yml` — 3-service regtest stack: bitcoind (:18443) + electrs (:30000) + chopsticks (:3000, Mempool-compatible API with faucet)
- `docker/cosmos/Dockerfile` — gaiad v22 node, chain-id `cosmoshub-4`, pre-funds test address `cosmos15wgtkntdf26hqan77g0kdsldcxjddypxughytg` (derived from private key `1234567890abcdef...`) with 100B uatom

## Releasing

The package is published to npm as the org-scoped `@sig-net/signet.js` (public access via
`publishConfig.access`). CI publishes with `yarn npm publish --provenance` using OIDC trusted
publishing — no npm tokens. The trusted-publisher config (npmjs.com → package settings → GitHub
Actions → `sig-net/signet.js`, workflow `deploy.yaml`) is already set up. To release:

```bash
yarn release:patch                          # or release:minor / release:major / release:beta — bumps package.json only
git commit -am "chore: release vX.Y.Z"      # land the bump on main (via PR or push)
git tag vX.Y.Z
git push origin vX.Y.Z                       # deploy.yaml runs full checks, then publishes to npm
gh release create vX.Y.Z --generate-notes    # auto-generates notes, tweak if needed
```

The deploy workflow fails if the tag doesn't match the package.json version. Prerelease versions
(`X.Y.Z-beta.N`) are published under the `beta` dist-tag automatically. `X.Y.Z-rc.N` tags are
reserved for testing the docs deploy and are excluded from `deploy.yaml`, so they never publish
to npm.

## CI

- `checks.yaml` — on PRs and pushes to main (and called by deploy): 4 parallel jobs after the `check` gate (format, lint, typecheck, build, compat): `test-evm`, `test-btc`, `test-cosmos`. E2E and integration tests are not in CI.
- `deploy.yaml` — on `vX.Y.Z` tag push (rc tags excluded): runs the full checks suite, then builds and publishes to npm with `yarn npm publish --provenance` via OIDC trusted publishing.
- `docs.yaml` — on version tag push (`v*.*.*`, which also matches `vX.Y.Z-rc*` for testing) and manual `workflow_dispatch`: builds the vocs docs as a static site and deploys it to GitHub Pages. Never runs on plain branch pushes.
