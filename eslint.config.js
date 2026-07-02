import tseslint from '@typescript-eslint/eslint-plugin'
import tsparser from '@typescript-eslint/parser'
import prettier from 'eslint-config-prettier'

/** @type {import('eslint').Linter.Config[]} */
export default [
  {
    ignores: [
      'node_modules/**',
      '**/dist/**',
      '**/build/**',
      '**/coverage/**',
      'packages/db/generated/**',
      'packages/db/prisma.config.ts',
      'design-system/**',
      '**/*.js.map',
      'tools/**',
      '**/.storybook/**',
      '**/vitest.config.d.ts',
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

      // No TODO/FIXME/HACK/XXX in source — fix it now or open a ticket
      'no-warning-comments': [
        'error',
        { terms: ['todo', 'fixme', 'hack', 'xxx'], location: 'anywhere' },
      ],

      // Guardrail: no `dangerouslySetInnerHTML`. Building HTML from any
      // app/user-derived value (patient names, protocol content, audit actors)
      // is a stored-XSS sink. Render values as React text nodes instead.
      // If a genuinely-trusted, sanitized HTML string is unavoidable, disable
      // this rule inline with an explanation of why the input is safe.
      'no-restricted-syntax': [
        'error',
        {
          selector: "JSXAttribute[name.name='dangerouslySetInnerHTML']",
          message:
            'dangerouslySetInnerHTML is a stored-XSS sink. Render values as React text nodes; only bypass with an inline eslint-disable that documents why the HTML is trusted.',
        },
        {
          // Guardrail: HTTP exceptions must carry a closed-enum ErrorCode, not a
          // bare string. Use `new XException({ code: ErrorCode.X, message })` so
          // clients can branch on a stable code instead of parsing prose.
          selector:
            "NewExpression[callee.name=/Exception$/]:matches([arguments.0.type='Literal'], [arguments.0.type='TemplateLiteral'])",
          message:
            'Throw HTTP exceptions with an ErrorCode object: new XException({ code: ErrorCode.X, message }). Raw string messages bypass the closed error-code enum.',
        },
      ],
    },
  },

  // Relax unsafe rules for test files — mocks are commonly typed as `any`
  {
    files: ['**/*.spec.ts', '**/*.test.ts', '**/*.test.tsx'],
    rules: {
      // Tests throw bare exceptions to exercise error paths; keep the XSS ban
      // but drop the ErrorCode-object requirement here.
      'no-restricted-syntax': [
        'error',
        {
          selector: "JSXAttribute[name.name='dangerouslySetInnerHTML']",
          message:
            'dangerouslySetInnerHTML is a stored-XSS sink. Render values as React text nodes; only bypass with an inline eslint-disable that documents why the HTML is trusted.',
        },
      ],
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unsafe-return': 'off',
      '@typescript-eslint/no-unsafe-argument': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/require-await': 'off',
      '@typescript-eslint/no-floating-promises': 'off',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },

  // Disable formatting rules handled by Prettier
  prettier,
]
