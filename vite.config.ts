import { resolve } from 'path'

import { defineConfig, type UserConfig } from 'vite'
import dts from 'vite-plugin-dts'

const external = ['path', 'fs', 'crypto', 'stream', 'util', 'events', 'buffer']

const getCommonConfig = (mode: string): UserConfig => ({
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      formats: ['es', 'cjs'],
      fileName: (format) =>
        `${mode}/index.${mode}.${format === 'es' ? 'js' : 'cjs'}`,
    },
    emptyOutDir: false,
    sourcemap: true,
    minify: true,
    rollupOptions: {
      external,
      treeshake: true,
      output: {
        exports: 'named',
        interop: 'auto',
        manualChunks: undefined,
        compact: true,
        generatedCode: {
          constBindings: true,
          objectShorthand: true,
        },
      },
    },
    outDir: 'dist',
  },
  resolve: {
    alias: {
      '@chains': resolve(__dirname, './src/chains'),
      '@utils': resolve(__dirname, './src/utils'),
    },
  },
})

export default defineConfig(({ mode }) => {
  const commonConfig = getCommonConfig(mode)

  if (mode === 'browser') {
    return {
      ...commonConfig,
      build: {
        ...commonConfig.build,
        target: 'esnext',
      },
      resolve: {
        ...commonConfig.resolve,
        mainFields: ['browser', 'module', 'main'],
        conditions: ['browser', 'import', 'default'],
      },
    }
  }

  return {
    ...commonConfig,
    build: {
      ...commonConfig.build,
      target: 'node18',
    },
    plugins: [
      dts({
        outDir: 'dist/types',
        include: ['src'],
        exclude: ['**/*.test.ts', '**/*.spec.ts'],
        tsconfigPath: './tsconfig.json',
        compilerOptions: {
          removeComments: true,
          skipLibCheck: true,
        },
      }),
    ],
    resolve: {
      ...commonConfig.resolve,
      mainFields: ['module', 'main'],
      conditions: ['node', 'import', 'default'],
    },
  }
})
