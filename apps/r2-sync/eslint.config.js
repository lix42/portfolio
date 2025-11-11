// @ts-check

import { baseConfig } from "@portfolio/eslint-config";

export default [
  ...baseConfig,
  {
    rules: {
      "no-console": "off",
    },
  },
];
