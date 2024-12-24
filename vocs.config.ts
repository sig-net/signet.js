import { defineConfig, type Config } from 'vocs'

export default defineConfig({
  title: 'Multichain Tools',
  description:
    'A TypeScript library for handling multi-chain transactions and signatures using MPC',
  twoslash: {
    compilerOptions: {
      strict: true,
      paths: {
        '@multichain-tools': ['./src'],
      },
    },
  },
  sidebar: [
    {
      text: 'Getting Started',
      items: [
        { text: 'Overview', link: '/' },
        { text: 'Installation', link: '/getting-started' },
        { text: 'Quick Start', link: '/getting-started#basic-setup' },
      ],
    },
    {
      text: 'Supported Chains',
      items: [
        { text: 'EVM Chains', link: '/chains/evm' },
        { text: 'Bitcoin', link: '/chains/bitcoin' },
        { text: 'Cosmos', link: '/chains/cosmos' },
      ],
    },
    {
      text: 'Core Concepts',
      items: [
        { text: 'Chain Interface', link: '/guides/implementing-new-chain' },
        { text: 'MPC Overview', link: '/guides/mpc-overview' },
      ],
    },
    {
      text: 'Implementation Guides',
      collapsed: true,
      items: [
        {
          text: 'Creating a New Chain',
          link: '/guides/implementing-new-chain',
        },
        {
          text: 'Bitcoin RPC Adapter',
          link: '/guides/implementing-btc-adapter',
        },
        {
          text: 'Chain Signature Contract',
          link: '/guides/implementing-signature-contract',
        },
      ],
    },
  ],

  socials: [
    {
      icon: 'github',
      link: 'https://github.com/near/multichain-tools',
    },
  ],

  theme: {
    accentColor: {
      light: '#00C08B',
      dark: '#00E6A6',
    },
  },
}) as Config
