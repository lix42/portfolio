import { defineWorkersConfig } from '@cloudflare/vitest-pool-workers/config';
import path from 'node:path';

export default defineWorkersConfig({
  resolve: {
    alias: {
      '@documents': path.resolve(__dirname, '../../documents'),
    },
  },
  test: {
    poolOptions: {
      workers: {
        isolatedStorage: false,
        wrangler: { configPath: './wrangler.jsonc' },
      },
    },
    server: {
      deps: {
        inline: [/^@supabase\//],
      },
    },
  },
});
