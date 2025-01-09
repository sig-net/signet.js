import { defineConfig, type Config } from 'vocs'

export default defineConfig({
  title: 'Signet.js',
  description:
    'A TypeScript library for handling multi-chain transactions and signatures using MPC',
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
      text: 'Getting Started',
      items: [
        { text: 'Overview', link: '/' },
        { text: 'Chain Interface', link: '/chain' },
        {
          text: 'Chain Signatures Contract',
          link: '/chain-signatures-contract',
        },
      ],
    },
    {
      text: 'Supported Chains',
      items: [
        { text: 'EVM Chains', link: '/chains/evm' },
        {
          text: 'Bitcoin',
          items: [
            { text: 'Overview', link: '/chains/bitcoin/bitcoin' },
            { text: 'RPC Adapter', link: '/chains/bitcoin/btc-rpc-adapter' },
          ],
        },
        { text: 'Cosmos', link: '/chains/cosmos' },
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
