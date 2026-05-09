// Purpose: Configure ESLint rules for the project.
// Why: Enforce consistent linting across JS/TS/Svelte files.
// Info flow: ESLint reads config -> lint results.
import js from '@eslint/js';
import svelte from 'eslint-plugin-svelte';
import prettier from 'eslint-config-prettier';
import globals from 'globals';

export default [
  {
    ignores: ['.svelte-kit/**', '.vercel/**', 'docs/evidence/**']
  },
  js.configs.recommended,
  ...svelte.configs['flat/recommended'],
  prettier,
  {
    files: ['probes/**/*.mjs'],
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.browser
      }
    }
  },
  {
    files: ['**/*.svelte', '**/*.js', '**/*.ts'],
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node
      }
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
