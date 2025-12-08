import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: ['./src/index.ts'],
  format: ['esm', 'cjs'],
  clean: true,
  dts: true,
  platform: 'neutral',
  // enable shims for node globals
  shims: true,
})
