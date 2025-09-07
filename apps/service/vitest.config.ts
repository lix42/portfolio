import { defineWorkersConfig } from '@cloudflare/vitest-pool-workers/config'
import tsconfigPaths from "vite-tsconfig-paths";

// @ts-expect-error vite-tsconfig-paths plugin is not typed for vite v6/v7
export default defineWorkersConfig({
  plugins: [tsconfigPaths()],
  test: {
    poolOptions: {
      workers: {
        isolatedStorage: false,
        wrangler: { configPath: "./wrangler.jsonc" },
      },
    },
    server: {
      deps: {
        inline: [/^@supabase\//],
      },
    },
  },
});