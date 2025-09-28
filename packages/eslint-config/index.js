// @ts-check

import js from '@eslint/js';
import tseslint from '@typescript-eslint/eslint-plugin';
import tsparser from '@typescript-eslint/parser';
import importPlugin from 'eslint-plugin-import';
import prettierConfig from 'eslint-config-prettier';

/**
 * Base configuration for all projects
 */
export const baseConfig = [
  js.configs.recommended,
  prettierConfig,
  {
    files: ['**/*.{js,jsx,ts,tsx}'],
    languageOptions: {
      parser: tsparser,
      parserOptions: {
        ecmaVersion: 2022,
        sourceType: 'module',
        project: true,
      },
    },
    plugins: {
      '@typescript-eslint': tseslint,
      'import': importPlugin,
    },
    rules: {
      ...tseslint.configs.recommended.rules,
      
      // Selective stricter TypeScript rules (not all of strict config)
      '@typescript-eslint/prefer-nullish-coalescing': 'warn',
      '@typescript-eslint/prefer-optional-chain': 'error',
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/await-thenable': 'error',
      '@typescript-eslint/no-misused-promises': 'error',
      
      // TypeScript specific rules
      '@typescript-eslint/no-unused-vars': ['error', { 
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
      }],
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-inferrable-types': 'error',
      '@typescript-eslint/consistent-type-imports': 'warn',
      '@typescript-eslint/consistent-type-exports': 'warn',
      '@typescript-eslint/no-non-null-assertion': 'warn',
      
      // Import rules (basic only to avoid resolver issues)
      'import/newline-after-import': 'error',
      'import/no-duplicates': 'error',
      'import/no-unresolved': 'off', // Let TypeScript handle this
      'import/no-relative-parent-imports': 'off',
      'import/no-useless-path-segments': 'error',
      
      // General code quality rules
      'prefer-const': 'error',
      'no-var': 'error',
      'no-console': 'warn',
      'eqeqeq': 'error',
      'curly': 'error',
      'no-duplicate-imports': 'off', // Using import/no-duplicates instead
      'no-unused-expressions': 'error',
      'no-unreachable': 'error',
      'prefer-template': 'error',
      'object-shorthand': 'error',
    },
  },
  {
    ignores: [
      'dist/**',
      'build/**',
      'node_modules/**',
      'coverage/**',
      '.waku/**',
      '**/*.config.js',
      '**/*.config.ts',
      '**/.prettierrc.js',
      'worker-configuration.d.ts',
    ],
  },
];

/**
 * Configuration for test files
 */
export const testConfig = {
  files: ['**/*.test.{js,jsx,ts,tsx}', '**/*.spec.{js,jsx,ts,tsx}'],
  languageOptions: {
    globals: {
      vi: 'readonly',
      describe: 'readonly',
      test: 'readonly',
      it: 'readonly',
      expect: 'readonly',
      beforeEach: 'readonly',
      afterEach: 'readonly',
      beforeAll: 'readonly',
      afterAll: 'readonly',
    },
  },
  rules: {
    'no-console': 'off',
    '@typescript-eslint/no-explicit-any': 'off',
    '@typescript-eslint/consistent-type-imports': 'off',
    '@typescript-eslint/no-floating-promises': 'off',
    '@typescript-eslint/no-non-null-assertion': 'off',
    '@typescript-eslint/await-thenable': 'off',
    '@typescript-eslint/no-misused-promises': 'off',
    'import/newline-after-import': 'off',
    'import/no-duplicates': 'warn',
  },
};

/**
 * Configuration for Cloudflare Workers environment
 */
export const cloudflareConfig = {
  languageOptions: {
    globals: {
      CloudflareBindings: 'readonly',
      console: 'readonly',
      fetch: 'readonly',
      Request: 'readonly',
      Response: 'readonly',
      URL: 'readonly',
      URLSearchParams: 'readonly',
      crypto: 'readonly',
      caches: 'readonly',
      addEventListener: 'readonly',
    },
  },
  rules: {
    'no-console': 'warn', // Allow console in workers but warn
  },
};