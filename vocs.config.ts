import { defineConfig, type Config } from 'vocs'

export default defineConfig({
  title: 'Sig Network',
  description:
    'Manage and use cryptographic key(s) across multiple chains or multiple contexts, with on-chain-enforced conditions',
  twoslash: {
    compilerOptions: {
      strict: true,
      paths: {
        'signet.js': ['./src'],
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
  logoUrl: 'signet-logo.png',
  iconUrl: 'signet-logo.png',
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
          text: 'Signing an arbitrary hash using EVM chain signatures',
          link: '/examples/arbitrary-hash',
        },
        {
          text: `Sponsor a chain signatures transaction on Solana`,
          link: '/examples/solana-fee-delegation',
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
          link: 'https://docs.rs/chain-signatures',
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
                  text: 'pollForRequestId',
                  link: '/signetjs/contracts/solana/poll-for-request-id',
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
  theme: {
    accentColor: {
      light: '#00C08B',
      dark: '#00E6A6',
    },
  },
}) as Config
