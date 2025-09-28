// @ts-check

import { baseConfig } from '@portfolio/eslint-config';
import { reactConfig } from '@portfolio/eslint-config/react.js';

export default [
  ...baseConfig,
  {
    ...reactConfig,
    ignores: [
      ...(baseConfig.find((config) => config.ignores)?.ignores || []),
      '.waku/**',
      'src/pages.gen.ts',
    ],
  },
];
