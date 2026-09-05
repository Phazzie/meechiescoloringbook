// Purpose: Configure ESLint rules for the project.
// Why: Enforce consistent linting across JS/TS/Svelte files.
// Info flow: ESLint reads config -> lint results.
import js from '@eslint/js';
import svelte from 'eslint-plugin-svelte';
import prettier from 'eslint-config-prettier';
import globals from 'globals';
import tsPlugin from '@typescript-eslint/eslint-plugin';
import tsParser from '@typescript-eslint/parser';

export default [
  { ignores: ['.svelte-kit/**', '.vercel/**', 'build/**', 'dist/**', 'coverage/**', '.agents/**'] },
  js.configs.recommended,
  ...svelte.configs['flat/recommended'],
  prettier,
  {
    // TypeScript files need the TypeScript parser at the flat-config language level.
    files: ['**/*.ts'],
    plugins: {
      '@typescript-eslint': tsPlugin
    },
    languageOptions: {
      parser: tsParser,
      globals: {
        ...globals.browser,
        ...globals.node
      }
    },
    rules: {
      // Use TypeScript-specific unused variable rule to correctly parse type signatures
      'no-undef': 'off',
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }]
    }
  },
  {
    // Svelte files keep eslint-plugin-svelte's parser and use TypeScript for script blocks.
    files: ['**/*.svelte'],
    plugins: {
      '@typescript-eslint': tsPlugin
    },
    languageOptions: {
      globals: {
        ...globals.browser
      },
      parserOptions: {
        parser: tsParser
      }
    },
    rules: {
      'no-undef': 'off',
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }]
    }
  },
  {
    // Node-authored project scripts and config files run outside the browser.
    files: ['*.js', '*.mjs', 'scripts/**/*.js', 'scripts/**/*.mjs'],
    languageOptions: {
      globals: {
        ...globals.node
      }
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
