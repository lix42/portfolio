// @ts-check

import reactPlugin from 'eslint-plugin-react';
import reactHooksPlugin from 'eslint-plugin-react-hooks';
import jsxA11yPlugin from 'eslint-plugin-jsx-a11y';

/**
 * React-specific configuration
 */
export const reactConfig = {
  files: ['**/*.{jsx,tsx}'],
  languageOptions: {
    parserOptions: {
      ecmaFeatures: {
        jsx: true,
      },
    },
  },
  plugins: {
    'react': reactPlugin,
    'react-hooks': reactHooksPlugin,
    'jsx-a11y': jsxA11yPlugin,
  },
  rules: {
    ...reactPlugin.configs.recommended.rules,
    ...reactHooksPlugin.configs.recommended.rules,
    ...jsxA11yPlugin.configs.recommended.rules,

    // React specific rules
    'react/react-in-jsx-scope': 'off', // Not needed with new JSX transform
    'react/prop-types': 'off', // Using TypeScript for prop validation
    'react/jsx-uses-react': 'off', // Not needed with new JSX transform
    'react/jsx-uses-vars': 'error',
    'react/self-closing-comp': 'error',
    'react/jsx-fragments': ['error', 'syntax'],
    'react/jsx-no-useless-fragment': 'error',
    'react/jsx-pascal-case': 'error',
    'react/no-array-index-key': 'warn',
    'react/no-unstable-nested-components': 'error',
    'react/jsx-key': ['error', {
      checkFragmentShorthand: true,
      checkKeyMustBeforeSpread: true,
      warnOnDuplicates: true,
    }],

    // React Hooks rules
    'react-hooks/rules-of-hooks': 'error',
    'react-hooks/exhaustive-deps': 'warn',

    // Accessibility rules
    'jsx-a11y/anchor-is-valid': 'error',
    'jsx-a11y/alt-text': 'error',
    'jsx-a11y/aria-props': 'error',
    'jsx-a11y/heading-has-content': 'error',
    'jsx-a11y/click-events-have-key-events': 'warn',
    'jsx-a11y/no-static-element-interactions': 'warn',
  },
  settings: {
    react: {
      version: 'detect',
    },
  },
};