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
        '@chains': ['./src/chains'],
        '@utils': ['./src/utils'],
        '@chains/*': ['./src/chains/*'],
        '@utils/*': ['./src/utils/*'],
      },
    },
  },
  sidebar: [
    {
      text: 'Chain Signatures',
      items: [{ text: 'Introduction to Chain Signatures', link: '/' }],
    },
    {
      text: 'Signet.js',
      items: [
        { text: 'Quick Start', link: '/signetjs' },
        { text: 'Contract Addresses', link: '/signetjs/contract-addresses' },
        {
          text: 'API Reference',
          items: [
            {
              text: 'EVM Chains',
              items: [
                { text: 'Overview', link: '/signetjs/chains/evm' },
                {
                  text: 'prepareTransactionForSigning',
                  link: '/signetjs/chains/evm/prepare-transaction-for-signing',
                },
                {
                  text: 'finalizeTransactionSigning',
                  link: '/signetjs/chains/evm/finalize-transaction-signing',
                },
                {
                  text: 'prepareMessageForSigning',
                  link: '/signetjs/chains/evm/prepare-message-for-signing',
                },
                {
                  text: 'finalizeMessageSigning',
                  link: '/signetjs/chains/evm/finalize-message-signing',
                },
                {
                  text: 'prepareTypedDataForSigning',
                  link: '/signetjs/chains/evm/prepare-typed-data-for-signing',
                },
                {
                  text: 'finalizeTypedDataSigning',
                  link: '/signetjs/chains/evm/finalize-typed-data-signing',
                },
              ],
            },
            {
              text: 'Bitcoin',
              items: [
                { text: 'Overview', link: '/signetjs/chains/bitcoin' },
                {
                  text: 'RPC Adapter',
                  link: '/signetjs/chains/bitcoin/btc-rpc-adapter',
                },
                {
                  text: 'prepareTransactionForSigning',
                  link: '/signetjs/chains/bitcoin/prepare-transaction-for-signing',
                },
                {
                  text: 'finalizeTransactionSigning',
                  link: '/signetjs/chains/bitcoin/finalize-transaction-signing',
                },
              ],
            },
            {
              text: 'Cosmos Chains',
              items: [
                { text: 'Overview', link: '/signetjs/chains/cosmos' },
                {
                  text: 'prepareTransactionForSigning',
                  link: '/signetjs/chains/cosmos/prepare-transaction-for-signing',
                },
                {
                  text: 'finalizeTransactionSigning',
                  link: '/signetjs/chains/cosmos/finalize-transaction-signing',
                },
              ],
            },
            {
              text: 'Common Methods',
              items: [
                {
                  text: 'deriveAddressAndPublicKey',
                  link: '/signetjs/chains/derive-address-and-public-key',
                },
                {
                  text: 'getBalance',
                  link: '/signetjs/chains/get-balance',
                },
                {
                  text: 'broadcastTx',
                  link: '/signetjs/chains/broadcast-tx',
                },
              ],
            },
          ],
        },
        {
          text: 'Advanced',
          items: [
            { text: 'Chain Interface', link: '/signetjs/advanced/chain' },
            {
              text: 'Chain Signatures Contract',
              link: '/signetjs/advanced/chain-signatures-contract',
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
