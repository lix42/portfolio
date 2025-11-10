// @ts-check

import { baseConfig } from '@portfolio/eslint-config';

export default [
  ...baseConfig,
  {
    ignores: [...(baseConfig.find((config) => config.ignores)?.ignores || [])],
  },
];
