// @ts-check

import pandaCss from '@pandacss/eslint-plugin';

/**
 * Panda CSS configuration
 * For projects using Panda CSS
 */
export const pandaCssConfig = {
  files: ['**/*.{js,jsx,ts,tsx}'],
  plugins: {
    '@pandacss': pandaCss,
  },
  rules: {
    ...pandaCss.configs.recommended.rules,
  },
};
