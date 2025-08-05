import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        index: resolve(__dirname, 'src/index.ts'),
        'cli/index': resolve(__dirname, 'src/cli/index.ts')
      },
      output: {
        format: 'es',
        entryFileNames: '[name].js'
      },
      external: [
        'commander',
        'gray-matter',
        '@iarna/toml',
        'fs',
        'fs/promises',
        'path',
        'os',
        'process'
      ]
    },
    outDir: 'dist',
    emptyOutDir: true,
    target: 'node18'
  },
  test: {
    globals: true,
    environment: 'node',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html']
    }
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src')
    }
  },
  define: {
    global: 'globalThis'
  }
});