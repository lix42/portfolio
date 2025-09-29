// @ts-check

import {
  baseConfig,
  cloudflareConfig,
  testConfig,
} from '@portfolio/eslint-config';
import { vitestConfig } from '@portfolio/eslint-config/vitest.js';

export default [
  ...baseConfig,
  {
    ...cloudflareConfig,
    ignores: [
      // @ts-expect-error
      ...(baseConfig.find((config) => 'ignores' in config && config.ignores)
        ?.ignores || []),
      'wrangler.json*',
      'worker-configuration.d.ts',
    ],
  },
  {
    ...testConfig,
    ...vitestConfig,
  },
];
