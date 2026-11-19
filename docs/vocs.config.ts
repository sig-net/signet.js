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
      text: 'Midnight',
      items: [
        { text: 'Overview', link: '/' },
        { text: 'Quickstart', link: '/quickstart' },
        {
          text: 'Sign Bidirectional Protocol Flow',
          link: '/midnight/protocol-flow',
        },
        { text: 'Integrator Guide', link: '/midnight/integrator-guide' },
        { text: 'Building the dApp', link: '/building-the-dapp' },
        { text: 'Privacy Model', link: '/privacy' },
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
          text: '@sig-net/midnight-signer',
          link: '/midnight/packages/midnight-signer',
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
      text: 'Reference',
      items: [
        { text: 'Networks and Addresses', link: '/networks' },
        {
          text: 'TypeScript Reference',
          link: '/midnight/typescript-reference',
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
