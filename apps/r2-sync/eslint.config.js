// @ts-check

import { baseConfig } from "@portfolio/eslint-config";

export default [
  ...baseConfig,
  {
    rules: {
      "no-console": "off",
    },
    ignores: [...(baseConfig.find((config) => config.ignores)?.ignores || [])],
  },
];
