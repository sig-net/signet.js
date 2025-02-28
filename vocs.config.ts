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
          text: 'Supported Chains',
          items: [
            { text: 'EVM Chains', link: '/signetjs/chains/evm' },
            {
              text: 'Bitcoin',
              items: [
                { text: 'Overview', link: '/signetjs/chains/bitcoin/bitcoin' },
                {
                  text: 'RPC Adapter',
                  link: '/signetjs/chains/bitcoin/btc-rpc-adapter',
                },
              ],
            },
            { text: 'Cosmos', link: '/signetjs/chains/cosmos' },
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
