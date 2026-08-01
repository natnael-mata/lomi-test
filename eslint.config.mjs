import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import globals from 'globals';
import tseslint from 'typescript-eslint';

/**
 * One flat config for the whole monorepo. `npm run lint` runs `eslint .` from
 * the root in a single pass, so a rule can never be enforced in one workspace
 * and silently skipped in another.
 *
 * Type-aware linting is deliberately NOT enabled: it needs a program per
 * workspace and roughly triples lint time, and `npm run typecheck` already
 * runs the real compiler with stricter settings than any lint rule.
 */
export default tseslint.config(
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/.next/**',
      '**/.pgdata/**',
      '**/generated/**',
      'apps/web/next-env.d.ts',
    ],
  },

  js.configs.recommended,
  ...tseslint.configs.recommended,

  {
    languageOptions: {
      globals: { ...globals.node },
      parserOptions: { ecmaVersion: 2022, sourceType: 'module' },
    },
    rules: {
      // The codebase handles money, exam timers and answer keys — an unused
      // variable is usually a half-finished thought, not noise.
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      // `any` erases exactly the guarantees TASK.md's definition of done relies on.
      '@typescript-eslint/no-explicit-any': 'error',
      eqeqeq: ['error', 'always', { null: 'ignore' }],
      'no-console': 'warn',
    },
  },

  // Entry points and operational scripts are meant to print.
  {
    files: [
      'apps/*/src/main.ts',
      'apps/api/scripts/**/*.{ts,mjs,js}',
      'apps/api/prisma/seed*.ts',
      'apps/*/src/**/*.cli.ts',
      'scripts/**/*.{ts,mjs,js}',
    ],
    rules: { 'no-console': 'off' },
  },

  // React/browser surface.
  {
    files: ['apps/web/**/*.{ts,tsx}'],
    languageOptions: { globals: { ...globals.browser } },
  },

  // Must come last: turns off every rule Prettier owns.
  prettier,
);
