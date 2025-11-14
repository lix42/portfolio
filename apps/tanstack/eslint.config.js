// @ts-check

import { baseConfig, cloudflareConfig } from '@portfolio/eslint-config';
import { reactConfig } from '@portfolio/eslint-config/react.js';

export default [
  ...baseConfig,
  {
    ...reactConfig,
    ...cloudflareConfig,
  },
];
