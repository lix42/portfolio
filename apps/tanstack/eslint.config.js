// @ts-check

import { baseConfig, cloudflareConfig } from '@portfolio/eslint-config';
import { reactConfig } from '@portfolio/eslint-config/react.js';
import { pandaCssConfig } from '@portfolio/eslint-config/pandacss.js';

export default [
  ...baseConfig,
  {
    ...reactConfig,
    ...cloudflareConfig,
    ...pandaCssConfig,
  },
];
