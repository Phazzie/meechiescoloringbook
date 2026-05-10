// Purpose: Configure ESLint rules for the project.
// Why: Enforce consistent linting across JS/TS/Svelte files.
// Info flow: ESLint reads config -> lint results.
import js from '@eslint/js';
import svelte from 'eslint-plugin-svelte';
import prettier from 'eslint-config-prettier';
import globals from 'globals';
import typescriptParser from '@typescript-eslint/parser';

export default [
  {
    ignores: ['.svelte-kit/**', '.vercel/**', 'docs/evidence/**']
  },
  js.configs.recommended,
  ...svelte.configs['flat/recommended'],
  prettier,
  {
    rules: {
      'no-unused-vars': ['error', {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
        caughtErrorsIgnorePattern: '^_'
      }]
    }
  },
  {
    files: ['probes/**/*.mjs'],
    languageOptions: {
      globals: {
        ...globals.node
      }
    }
  },
  {
    files: ['**/*.svelte', '**/*.js', '**/*.ts'],
    languageOptions: {
      globals: {
        ...globals.browser
      }
    }
  },
  {
    files: ['**/*.ts'],
    languageOptions: {
      parser: typescriptParser,
    },
  },
  {
    files: ['**/*.svelte'],
    languageOptions: {
      parserOptions: {
        parser: typescriptParser
      }
    }
  }
];
