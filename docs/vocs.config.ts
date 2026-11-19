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
  // Shiki bundles no Compact grammar, and TypeScript's is the closest it has.
  codeHighlight: { langAlias: { compact: 'typescript' } },
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
      text: 'Midnight Integration',
      items: [
        { text: 'Sig Network Midnight Integration', link: '/' },
        {
          text: 'Sign Bidirectional Protocol Flow',
          link: '/midnight/protocol-flow',
        },
        { text: 'Integrator Guide', link: '/midnight/integrator-guide' },
      ],
    },
    {
      text: 'Examples',
      items: [
        {
          text: 'Midnight Contracts Calling Foreign Chains',
          link: '/midnight/examples',
        },
        {
          text: 'ERC20 Vault',
          link: '/midnight/erc20-vault',
          items: [
            { text: 'Deposit', link: '/midnight/erc20-vault/deposit' },
            { text: 'Withdraw', link: '/midnight/erc20-vault/withdraw' },
            { text: 'Swap', link: '/midnight/erc20-vault/swap' },
            { text: 'Supply', link: '/midnight/erc20-vault/supply' },
            { text: 'Redeem', link: '/midnight/erc20-vault/redeem' },
            {
              text: 'Contention handling',
              link: '/midnight/erc20-vault/contention-handling',
            },
          ],
        },
      ],
    },
    {
      text: 'Packages',
      items: [
        { text: 'Packages', link: '/midnight/packages' },
        { text: '@sig-net/midnight', link: '/midnight/packages/midnight' },
        {
          text: '@sig-net/midnight-contract',
          link: '/midnight/packages/midnight-contract',
        },
        {
          text: '@sig-net/midnight-responder',
          link: '/midnight/packages/midnight-responder',
        },
        {
          text: '@sig-net/midnight-contract-deploy',
          link: '/midnight/packages/midnight-contract-deploy',
        },
        {
          text: '@sig-net/midnight-serde',
          link: '/midnight/packages/midnight-serde',
        },
        {
          text: 'signet-midnight-serde',
          link: '/midnight/packages/signet-midnight-serde',
        },
      ],
    },
    {
      text: 'Contributing',
      items: [
        { text: 'Contributor Guide', link: '/midnight/contributor-guide' },
        { text: 'Prerequisites', link: '/midnight/prerequisites' },
      ],
    },
    {
      text: 'Signet.js SDK Reference',
      items: [
        {
          text: 'Chain Adapter Interface',
          link: '/primitives/chain-adapter-interface',
        },
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
      ],
    },
    {
      text: 'Other Signers',
      items: [
        { text: 'Canton Signer (Daml Docs)', link: '/contract-api/canton' },
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
