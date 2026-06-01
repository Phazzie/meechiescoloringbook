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
    // Browser globals scoped to Svelte components only — server-only files
    // won't silently accept window/document/navigator without a lint error.
    files: ['**/*.svelte'],
    languageOptions: {
      globals: globals.browser,
      parserOptions: {
        parser: (await import('@typescript-eslint/parser')).default
      }
    },
    rules: {
      // The base no-unused-vars rule produces false positives on TypeScript
      // type-annotation parameter names (e.g. callback signatures like
      // `(id: string) => void`). svelte-check with TypeScript strict mode
      // covers genuine unused locals in Svelte/TS files.
      'no-unused-vars': 'off'
    }
  },
  {
    // Node globals scoped to scripts and probes — these run in Node.js, not
    // in the browser, so process/require/etc. are legitimate here.
    files: ['scripts/**', 'probes/**'],
    languageOptions: {
      globals: globals.node
    }
  }
];
