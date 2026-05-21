// Purpose: Configure ESLint rules for the project.
// Why: Enforce consistent linting across JS/TS/Svelte files.
// Info flow: ESLint reads config -> lint results.
import js from '@eslint/js';
import svelte from 'eslint-plugin-svelte';
import prettier from 'eslint-config-prettier';
import globals from 'globals';

export default [
  {
    ignores: [
      '.svelte-kit/**',
      '.vercel/**',
      'build/**',
      'dist/**',
      'coverage/**',
      'docs/evidence/**'
    ]
  },
  js.configs.recommended,
  {
    files: ['**/*.{js,mjs,cjs}'],
    languageOptions: {
      globals: {
        ...globals.node
      }
    }
  },
  {
    files: ['**/*.{ts,mts,cts}'],
    languageOptions: {
      parser: (await import('@typescript-eslint/parser')).default
    }
  },
  {
    files: ['src/**/*.{js,ts,svelte}', 'tests/**/*.{js,ts}', 'static/**/*.js'],
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.es2021
      }
    }
  },
  ...svelte.configs['flat/recommended'],
  prettier,
  {
    files: ['**/*.{ts,svelte}'],
    rules: {
      'no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_'
        }
      ]
    }
  },
  {
    files: ['**/*.svelte'],
    languageOptions: {
      parserOptions: {
        parser: (await import('@typescript-eslint/parser')).default
      }
    }
  }
];
