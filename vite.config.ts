import { resolve } from 'path'

import { defineConfig } from 'vite'
import dts from 'vite-plugin-dts'

export default defineConfig({
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      formats: ['es', 'cjs'],
      fileName: (format) => `index.${format === 'es' ? 'js' : 'cjs'}`,
    },
    rollupOptions: {
      external: [
        'cosmjs-types',
        '@near-js/accounts',
        '@near-js/crypto',
        '@near-js/keystores',
        '@near-js/transactions',
        '@near-wallet-selector/core',
        'near-api-js',
        '@near-js/utils',
      ],
    },
  },
  plugins: [
    dts({
      exclude: ['docs/**'],
    }),
  ],
  resolve: {
    alias: {
      '@chains': '/src/chains',
      '@utils': '/src/utils',
    },
  },
})
