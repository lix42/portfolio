// @ts-check

import { baseConfig, cloudflareConfig } from '@portfolio/eslint-config';
import { testConfig } from '@portfolio/eslint-config/test.js';

export default [
  ...baseConfig,
  {
    ...cloudflareConfig,
    ignores: ['wrangler.json*'],
  },
  testConfig,
];
