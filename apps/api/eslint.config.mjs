import { defineConfig, globalIgnores } from 'eslint/config';
import nextTs from 'eslint-config-next/typescript';

export default defineConfig([
  ...nextTs,
  {
    files: ['**/*.ts'],
    rules: {
      'no-console': 'error',
    },
  },
  globalIgnores(['dist/**', 'coverage/**']),
]);
