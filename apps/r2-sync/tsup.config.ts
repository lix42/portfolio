import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/cli.ts'],
  format: ['esm'],
  dts: false, // Don't need type definitions for the CLI
  sourcemap: true,
  clean: true,
  bundle: true,
  minify: false,
  external: ['dotenv'], // Keep CommonJS dotenv external to avoid require shim in ESM bundle
  noExternal: ['@portfolio/shared'], // Bundle the shared package
  platform: 'node',
  target: 'node18',
  outDir: 'dist',
  banner: {
    js: '#!/usr/bin/env node',
  },
});
