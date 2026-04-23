import tseslint from '@typescript-eslint/eslint-plugin'
import tsparser from '@typescript-eslint/parser'
import prettier from 'eslint-config-prettier'

/** @type {import('eslint').Linter.Config[]} */
export default [
  {
    ignores: [
      'node_modules/**',
      'dist/**',
      'build/**',
      'packages/db/generated/**',
      'design-system/**',
      '**/*.js.map',
      'tools/**',
      '**/.storybook/**',
    ],
  },

  // TypeScript files
  {
    files: ['**/*.ts', '**/*.tsx'],
    plugins: {
      '@typescript-eslint': tseslint,
    },
    languageOptions: {
      parser: tsparser,
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      ...tseslint.configs['recommended'].rules,
      ...tseslint.configs['recommended-type-checked'].rules,

      // Enforce explicit return types on exported functions
      '@typescript-eslint/explicit-module-boundary-types': 'error',

      // Disallow `any` — use `unknown` instead
      '@typescript-eslint/no-explicit-any': 'error',

      // Prefer `const` assertions
      '@typescript-eslint/prefer-as-const': 'error',

      // No unused variables (errors, not warnings)
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],

      // No floating promises — must be awaited or explicitly void
      '@typescript-eslint/no-floating-promises': 'error',

      // Consistent type imports
      '@typescript-eslint/consistent-type-imports': ['error', { prefer: 'type-imports' }],
    },
  },

  // Disable formatting rules handled by Prettier
  prettier,
]
