import { defineWorkersConfig } from '@cloudflare/vitest-pool-workers/config';
import type { PluginOption } from 'vite';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineWorkersConfig({
  plugins: [tsconfigPaths()] as PluginOption[],
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
