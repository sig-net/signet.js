import { fileURLToPath } from 'node:url'
import { defineConfig, type Config } from 'vocs/config'

const repoRoot = fileURLToPath(new URL('..', import.meta.url))

// GitHub Pages serves project sites under /<repo>/. The deploy workflow sets
// DOCS_BASE_PATH=/signet.js/; local dev/preview default to the root path.
const basePath = process.env.DOCS_BASE_PATH ?? '/'

export default defineConfig({
  srcDir: '.',
  // Emit a fully static site (per-route HTML) so it can be hosted on any
  // static host, e.g. GitHub Pages. Without this vocs builds a Waku SSR
  // server bundle that needs a Node runtime.
  renderStrategy: 'full-static',
  basePath,
  title: 'Sig Network',
  description:
    'Manage and use cryptographic key(s) across multiple chains or multiple contexts, with on-chain-enforced conditions',
  twoslash: {
    twoslashOptions: {
      vfsRoot: repoRoot,
      compilerOptions: {
        strict: true,
        paths: {
          '@sig-net/signet.js': ['./src'],
          '@chain-adapters': ['./src/chain-adapters/index.ts'],
          '@contracts': ['./src/contracts/index.ts'],
          '@utils': ['./src/utils/index.ts'],
          '@constants': ['./src/constants.ts'],
          '@types': ['./src/types.ts'],
          '@chain-adapters/*': ['./src/chain-adapters/*'],
          '@contracts/*': ['./src/contracts/*'],
          '@utils/*': ['./src/utils/*'],
        },
      },
    },
  },
  // Absolute (base-path-prefixed) so the logo/favicon resolve on nested routes;
  // vocs does not prefix logoUrl/iconUrl with basePath automatically.
  logoUrl: `${basePath}signet-logo.png`,
  iconUrl: `${basePath}signet-logo.png`,
  sidebar: [
    {
      text: 'Introduction',
      items: [
        { text: 'Introduction to Chain Signatures', link: '/' },
        {
          text: 'Signet.js Quickstart',
          link: '/introduction/signet-quick-start',
        },
      ],
    },
    {
      text: 'Architecture',
      items: [
        {
          text: 'Sign Bidirectional Flow',
          link: '/architecture/sign-bidirectional',
        },
      ],
    },
    {
      text: 'Primitives',
      items: [
        { text: 'Contract Addresses', link: '/primitives/contract-addresses' },
        {
          text: 'Chain Adapter Interface',
          link: '/primitives/chain-adapter-interface',
        },
        {
          text: 'Chain Contract Interfaces',
          link: '/primitives/chain-contract-interface',
        },
      ],
    },
    {
      text: 'Examples',
      items: [
        {
          text: 'Holding Ethereum assets from Solana',
          link: '/examples/cross-chain-deposit',
        },
        {
          text: 'Staking on Ethereum from Solana',
          link: '/examples/solana-stake-ethereum',
        },
        {
          text: 'What you can build',
          link: '/examples/what-you-can-build',
        },
      ],
    },
    {
      text: 'Contract API Reference',
      items: [
        {
          text: 'EVM Contract',
          items: [
            {
              text: 'Functions',
              link: '/contract-api/evm/functions',
            },
            {
              text: 'Events',
              link: '/contract-api/evm/events',
            },
            {
              text: 'Types',
              link: '/contract-api/evm/types',
            },
          ],
        },
        {
          text: 'Solana Program (Rust Docs)',
          link: '/contract-api/solana',
        },
        {
          text: 'Canton Signer (Daml Docs)',
          link: '/contract-api/canton',
        },
      ],
    },
    {
      text: 'Signet.js SDK Reference',
      items: [
        {
          text: 'Chain Adapters',
          items: [
            {
              text: 'EVM Chains',
              items: [
                { text: 'Overview', link: '/signetjs/chain-adapters/evm' },
                {
                  text: 'prepareTransactionForSigning',
                  link: '/signetjs/chain-adapters/evm/prepare-transaction-for-signing',
                },
                {
                  text: 'finalizeTransactionSigning',
                  link: '/signetjs/chain-adapters/evm/finalize-transaction-signing',
                },
                {
                  text: 'prepareMessageForSigning',
                  link: '/signetjs/chain-adapters/evm/prepare-message-for-signing',
                },
                {
                  text: 'finalizeMessageSigning',
                  link: '/signetjs/chain-adapters/evm/finalize-message-signing',
                },
                {
                  text: 'prepareTypedDataForSigning',
                  link: '/signetjs/chain-adapters/evm/prepare-typed-data-for-signing',
                },
                {
                  text: 'finalizeTypedDataSigning',
                  link: '/signetjs/chain-adapters/evm/finalize-typed-data-signing',
                },
              ],
            },
            {
              text: 'Bitcoin',
              items: [
                { text: 'Overview', link: '/signetjs/chain-adapters/bitcoin' },
                {
                  text: 'RPC Adapter',
                  link: '/signetjs/chain-adapters/bitcoin/btc-rpc-adapter',
                },
                {
                  text: 'prepareTransactionForSigning',
                  link: '/signetjs/chain-adapters/bitcoin/prepare-transaction-for-signing',
                },
                {
                  text: 'finalizeTransactionSigning',
                  link: '/signetjs/chain-adapters/bitcoin/finalize-transaction-signing',
                },
              ],
            },
            {
              text: 'Cosmos Chains',
              items: [
                { text: 'Overview', link: '/signetjs/chain-adapters/cosmos' },
                {
                  text: 'prepareTransactionForSigning',
                  link: '/signetjs/chain-adapters/cosmos/prepare-transaction-for-signing',
                },
                {
                  text: 'finalizeTransactionSigning',
                  link: '/signetjs/chain-adapters/cosmos/finalize-transaction-signing',
                },
              ],
            },
            {
              text: 'deriveAddressAndPublicKey',
              link: '/signetjs/chain-adapters/derive-address-and-public-key',
            },
            {
              text: 'getBalance',
              link: '/signetjs/chain-adapters/get-balance',
            },
            {
              text: 'broadcastTx',
              link: '/signetjs/chain-adapters/broadcast-tx',
            },
          ],
        },
        {
          text: 'Contracts',
          items: [
            {
              text: 'EVM',
              items: [
                {
                  text: 'constructor',
                  link: '/signetjs/contracts/evm/constructor',
                },
                {
                  text: 'getCurrentSignatureDeposit',
                  link: '/signetjs/contracts/evm/get-current-signature-deposit',
                },
                {
                  text: 'getDerivedPublicKey',
                  link: '/signetjs/contracts/evm/get-derived-public-key',
                },
                {
                  text: 'getPublicKey',
                  link: '/signetjs/contracts/evm/get-public-key',
                },
                {
                  text: 'getLatestKeyVersion',
                  link: '/signetjs/contracts/evm/get-latest-key-version',
                },
                { text: 'sign', link: '/signetjs/contracts/evm/sign' },
              ],
            },
            {
              text: 'Solana',
              items: [
                {
                  text: 'constructor',
                  link: '/signetjs/contracts/solana/constructor',
                },
                {
                  text: 'getCurrentSignatureDeposit',
                  link: '/signetjs/contracts/solana/get-current-signature-deposit',
                },
                {
                  text: 'getDerivedPublicKey',
                  link: '/signetjs/contracts/solana/get-derived-public-key',
                },
                {
                  text: 'getPublicKey',
                  link: '/signetjs/contracts/solana/get-public-key',
                },
                {
                  text: 'waitForEvent',
                  link: '/signetjs/contracts/solana/wait-for-event',
                },
                { text: 'sign', link: '/signetjs/contracts/solana/sign' },
              ],
            },
          ],
        },
      ],
    },
  ],
  socials: [
    {
      icon: 'github',
      link: 'https://github.com/sig-net',
    },
  ],
  // Sig Network brand green, brightened in dark mode for contrast.
  accentColor: 'light-dark(#00C08B, #00E6A6)',
}) as Config
