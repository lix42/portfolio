// @ts-check

import {
  baseConfig,
  testConfig,
  cloudflareConfig,
} from '@portfolio/eslint-config';
import { vitestConfig } from '@portfolio/eslint-config/vitest.js';

export default [
  ...baseConfig,
  {
    ...cloudflareConfig,
    ignores: [
      ...(baseConfig.find((config) => config.ignores)?.ignores || []),
      'wrangler.json*',
      'worker-configuration.d.ts',
    ],
  },
  {
    ...testConfig,
    ...vitestConfig,
  },
];
