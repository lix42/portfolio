import path from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@documents': path.resolve(__dirname, '../../documents'),
      'cloudflare:workers': path.resolve(
        __dirname,
        './test/cloudflare-workers-shim.ts'
      ),
    },
  },
  test: {
    coverage: {
      provider: 'istanbul',
      reporter: ['text', 'json', 'html'],
      reportsDirectory: './coverage',
    },
  },
});
