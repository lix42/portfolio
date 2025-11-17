// @ts-check
import { baseConfig, cloudflareConfig } from '@portfolio/eslint-config';

export default [
  ...baseConfig,
  {
    ...cloudflareConfig,
    ignores: ['wrangler.jsonc', 'schema/*.json']
  }
];
