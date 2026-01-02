// @ts-check

import js from '@eslint/js';
import tseslint from '@typescript-eslint/eslint-plugin';
import tsparser from '@typescript-eslint/parser';
import gitignore from 'eslint-config-flat-gitignore';
import importPlugin from 'eslint-plugin-import';
// @ts-expect-error - prettier plugin recommended config
import prettierRecommended from 'eslint-plugin-prettier/recommended';
import sonarjs from 'eslint-plugin-sonarjs';

/**
 * Base configuration for all projects
 */
export const baseConfig = [
  gitignore(),
  js.configs.recommended,
  sonarjs.configs.recommended,
  importPlugin.flatConfigs.recommended,
  prettierRecommended,
  {
    files: ['**/*.{js,jsx,ts,tsx}'],
    languageOptions: {
      parser: tsparser,
      parserOptions: {
        ecmaVersion: 2022,
        sourceType: 'module',
      },
    },
    plugins: {
      '@typescript-eslint': tseslint,
    },
    rules: {
      ...tseslint.configs.recommended.rules,

      // SonarJS customizations
      'sonarjs/todo-tag': 'warn',
      'sonarjs/no-nested-conditional': 'off',

      // Type-aware rules disabled (they require parserOptions.project)
      '@typescript-eslint/prefer-nullish-coalescing': 'off',
      '@typescript-eslint/prefer-optional-chain': 'off',
      '@typescript-eslint/no-floating-promises': 'off',
      '@typescript-eslint/await-thenable': 'off',
      '@typescript-eslint/no-misused-promises': 'off',

      // TypeScript specific rules
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
        },
      ],
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-inferrable-types': 'error',
      '@typescript-eslint/consistent-type-imports': 'off', // Type-aware
      '@typescript-eslint/consistent-type-exports': 'off', // Type-aware
      '@typescript-eslint/no-non-null-assertion': 'warn',

      // Import rules overrides
      'import/no-unresolved': 'off', // Let TypeScript handle this
      'import/order': [
        'error',
        {
          groups: [
            'builtin',
            'external',
            'internal',
            ['parent', 'sibling', 'index'],
          ],
          'newlines-between': 'always',
          alphabetize: {
            order: 'asc',
            caseInsensitive: true,
          },
        },
      ],

      // General code quality rules
      'prefer-const': 'error',
      'no-var': 'error',
      'no-console': 'warn',
      eqeqeq: 'error',
      curly: 'error',
      'no-duplicate-imports': 'off', // Using import/no-duplicates instead
      'no-unused-expressions': 'error',
      'no-unreachable': 'error',
      'prefer-template': 'error',
      'object-shorthand': 'error',
      'no-undef': 'off', // TypeScript handles this better
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
 * Configuration for Cloudflare Workers environment
 */
export const cloudflareConfig = {
  files: ['**/*.{js,jsx,ts,tsx}'],
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
      Env: 'readonly',
      ExecutionContext: 'readonly',
      ExportedHandler: 'readonly',
    },
  },
  rules: {
    'no-console': 'warn', // Allow console in workers but warn
    'no-undef': 'off', // TypeScript handles this better
  },
};
