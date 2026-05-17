// Purpose: Configure ESLint rules for the project.
// Why: Enforce consistent linting across JS/TS/Svelte files with correct environment globals.
// Info flow: ESLint reads config -> lint results.
import js from '@eslint/js';
import svelte from 'eslint-plugin-svelte';
import prettier from 'eslint-config-prettier';
import globals from 'globals';

export default [
  // Exclude auto-generated SvelteKit output and build artifacts — linting them
  // produces noise from code we don't own.
  {
    ignores: ['.svelte-kit/**', 'dist/**', 'build/**']
  },

  js.configs.recommended,

  // Relax no-unused-vars globally:
  //   args:'none'          — TypeScript type-annotation parameter names (e.g. in
  //                          `(base64: string) => void`) are parsed as identifiers
  //                          but are never "used" at runtime; flagging them is a FP.
  //   caughtErrors:'none'  — empty catch clauses are intentional in probe/utility code.
  //   ignoreRestSiblings   — standard JS pattern for intentionally omitting keys.
  {
    rules: {
      'no-unused-vars': ['error', { args: 'none', caughtErrors: 'none', ignoreRestSiblings: true }]
    }
  },

  ...svelte.configs['flat/recommended'],
  prettier,

  // Svelte files run in the browser. Add all browser globals so that
  // navigator, setTimeout, crypto, HTMLInputElement, etc. are recognised,
  // and keep the TypeScript parser for <script lang="ts"> blocks.
  {
    files: ['**/*.svelte'],
    languageOptions: {
      globals: {
        ...globals.browser
      },
      parserOptions: {
        parser: (await import('@typescript-eslint/parser')).default
      }
    }
  },

  // Probe scripts and top-level tooling are Node.js processes. They also
  // reference browser globals (localStorage, fetch, console) because some
  // probes exercise browser-side seams.
  {
    files: ['probes/**', 'scripts/**', '*.config.js', '*.config.ts'],
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node
      }
    }
  }
];
