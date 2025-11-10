// @ts-check

import { baseConfig, cloudflareConfig } from '@portfolio/eslint-config';
import { reactConfig } from '@portfolio/eslint-config/react.js';

export default [
  ...baseConfig,
  {
    ...reactConfig,
    ...cloudflareConfig,
    ignores: [
      ...(baseConfig.find((config) => config.ignores)?.ignores || []),
      '.react-router/**',
      'build/**',
    ],
  },
  // Note: Panda CSS config commented out until panda.config.ts is created
  // {
  //   ...pandaCssConfig,
  //   ignores: [
  //     ...(baseConfig.find((config) => config.ignores)?.ignores || []),
  //     '.react-router/**',
  //     'build/**',
  //   ],
  // },
];
