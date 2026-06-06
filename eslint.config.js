// Purpose: Configure ESLint rules for the project.
// Why: Enforce consistent linting across JS/TS/Svelte files.
// Info flow: ESLint reads config -> lint results.
import js from '@eslint/js';
import svelte from 'eslint-plugin-svelte';
import prettier from 'eslint-config-prettier';
import globals from 'globals';
import tsPlugin from '@typescript-eslint/eslint-plugin';

export default [
  { ignores: ['.svelte-kit/**', 'build/**', 'dist/**'] },
  js.configs.recommended,
  ...svelte.configs['flat/recommended'],
  prettier,
  {
    // Svelte and TypeScript files: browser globals (DOM, fetch, crypto, etc.) + TypeScript parser.
    // The no-undef rule lacks browser context by default in flat config.
    files: ['**/*.svelte', '**/*.ts'],
    plugins: {
      '@typescript-eslint': tsPlugin
    },
    languageOptions: {
      globals: {
        ...globals.browser
      },
      parserOptions: {
        parser: (await import('@typescript-eslint/parser')).default
      }
    },
    rules: {
      // Use TypeScript-specific unused variable rule to correctly parse type signatures
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }]
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
    }
  }
];
