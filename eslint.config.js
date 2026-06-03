// Purpose: Configure ESLint rules for the project.
// Why: Enforce consistent linting across JS/TS/Svelte files.
// Info flow: ESLint reads config -> lint results.
import js from '@eslint/js';
import svelte from 'eslint-plugin-svelte';
import prettier from 'eslint-config-prettier';
import globals from 'globals';

export default [
  js.configs.recommended,
  ...svelte.configs['flat/recommended'],
  prettier,
  {
    // Svelte files: browser globals (DOM, fetch, crypto, etc.) + TypeScript parser.
    // The no-undef rule lacks browser context by default in flat config.
    files: ['**/*.svelte'],
    languageOptions: {
      globals: {
        ...globals.browser
      },
      parserOptions: {
        parser: (await import('@typescript-eslint/parser')).default
      }
    },
    rules: {
      // Function-type parameter names in TS type declarations look like unused vars to
      // plain ESLint; suppress by convention: prefix unused names with _.
      'no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }]
    }
  },
  {
    // Probe scripts run in Node (process, fetch) with occasional browser API references.
    files: ['probes/**/*.mjs'],
    languageOptions: {
      globals: {
        ...globals.node,
        fetch: 'readonly'
      }
    },
    rules: {
      'no-unused-vars': ['error', { caughtErrorsIgnorePattern: '^_' }]
    }
  }
];
