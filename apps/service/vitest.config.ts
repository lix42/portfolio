import path from 'node:path';
import { defineWorkersConfig } from '@cloudflare/vitest-pool-workers/config';

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
