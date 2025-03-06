import { resolve } from 'path'

import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
  },
  resolve: {
    alias: {
      '@chain-adapters': resolve(__dirname, './src/chain-adapters'),
      '@contracts': resolve(__dirname, './src/contracts'),
      '@utils': resolve(__dirname, './src/utils'),
      '@constants': resolve(__dirname, './src/constants.ts'),
      '@types': resolve(__dirname, './src/types.ts'),
    },
  },
})
