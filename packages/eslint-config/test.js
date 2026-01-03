// @ts-check

import vitest from '@vitest/eslint-plugin';
import testingLibrary from 'eslint-plugin-testing-library';

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
