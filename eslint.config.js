// @ts-check

import { baseConfig } from './packages/eslint-config/index.js';

/**
 * Root ESLint configuration for the monorepo
 * This is used by lint-staged to lint files from all packages
 */
export default [...baseConfig];
