import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{js,jsx}'],
    extends: [
      js.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      globals: globals.browser,
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
  },
  {
    // A provider and its consumer hook belong in one file; splitting them only
    // to satisfy fast-refresh granularity would move the contract away from
    // the context it guards.
    files: ['src/contexts/**'],
    rules: { 'react-refresh/only-export-components': 'off' },
  },
  {
    // shadcn generates these and exports cva variant helpers next to the
    // components. Re-splitting them would be undone by the next `add`.
    files: ['src/components/ui/**'],
    rules: { 'react-refresh/only-export-components': 'off' },
  },
])
