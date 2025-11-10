// @ts-check

import { baseConfig, cloudflareConfig } from '@portfolio/eslint-config';
import { testConfig } from '@portfolio/eslint-config/test.js';

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
  testConfig,
];
