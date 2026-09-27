import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'
import noBareTextSiblings from './eslint-rules/no-bare-text-siblings.js'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
  },
  {
    // Shipped components only: tests render throwaway markup that no visitor
    // ever translates. Type-aware, so it is scoped to the files it inspects.
    files: ['src/**/*.tsx'],
    ignores: ['src/**/__tests__/**', 'src/**/*.test.tsx', 'src/tests/**'],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    plugins: {
      local: { rules: { 'no-bare-text-siblings': noBareTextSiblings } },
    },
    rules: {
      'local/no-bare-text-siblings': 'error',
    },
  },
])
