// @ts-check

import testingLibrary from 'eslint-plugin-testing-library';
import vitest from 'eslint-plugin-vitest';

/**
 * Configuration for test files (Vitest + Testing Library)
 */
export const testConfig = {
  files: ['**/*.test.{js,jsx,ts,tsx}', '**/*.spec.{js,jsx,ts,tsx}'],
  plugins: {
    vitest,
    'testing-library': testingLibrary,
  },
  rules: {
    ...vitest.configs.recommended.rules,
    ...testingLibrary.configs['flat/react'].rules,

    // Allow console in tests
    'no-console': 'off',

    // Relax some rules for tests
    '@typescript-eslint/no-explicit-any': 'off',
    '@typescript-eslint/no-non-null-assertion': 'off',
  },
  languageOptions: {
    globals: vitest.environments.env.globals,
  },
};
