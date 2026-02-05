<!--
Purpose: Summarize evidence artifacts in plain language.
Why: Help non-coders understand proof coverage without reading code.
Info flow: evidence files -> summary -> review.
-->
# Proof Tape

Generated at: 2026-01-27T18:46:25.204Z
Evidence folder: docs/evidence/2026-01-27

Files included:
- assumption-alarm.json (1555 bytes)
- chamber-lock.json (9743 bytes)
- cipher-gate.json (810 bytes)
- clan-chain.json (1171 bytes)
- clan-chain.md (837 bytes)
- npm-build-2026-01-27-0350.txt (5676 bytes)
  Commands: coloringbook-svelte@0.0.1 build | vite build | Using @sveltejs/adapter-auto
- npm-test-2026-01-27-0000.txt (916 bytes)
  Commands: coloringbook-svelte@0.0.1 test | vitest run
- npm-test-2026-01-27-0330.txt (919 bytes)
  Commands: coloringbook-svelte@0.0.1 test | vitest run
- npm-verify-2026-01-27-0000.txt (1902 bytes)
  Commands: coloringbook-svelte@0.0.1 verify | npm run chamber:lock && npm run verify:runner && npm run shaolin:lint && npm run assumption:alarm && npm run seam:ledger && npm run clan:chain && npm run proof:tape && npm run cipher:gate | coloringbook-svelte@0.0.1 chamber:lock | node scripts/chamber-lock.mjs | coloringbook-svelte@0.0.1 verify:runner | node scripts/verify-runner.mjs | coloringbook-svelte@0.0.1 check | svelte-kit sync && svelte-check --tsconfig ./tsconfig.json | coloringbook-svelte@0.0.1 test | vitest run | coloringbook-svelte@0.0.1 shaolin:lint | node scripts/shaolin-lint.mjs | coloringbook-svelte@0.0.1 assumption:alarm | node scripts/assumption-alarm.mjs | coloringbook-svelte@0.0.1 seam:ledger | node scripts/seam-ledger.mjs | coloringbook-svelte@0.0.1 clan:chain | node scripts/clan-chain.mjs | coloringbook-svelte@0.0.1 proof:tape | node scripts/proof-tape.mjs
- npm-verify-2026-01-27-0340.txt (615 bytes)
  Commands: coloringbook-svelte@0.0.1 verify | npm run chamber:lock && npm run verify:runner && npm run shaolin:lint && npm run assumption:alarm && npm run seam:ledger && npm run clan:chain && npm run proof:tape && npm run cipher:gate | coloringbook-svelte@0.0.1 chamber:lock | node scripts/chamber-lock.mjs | coloringbook-svelte@0.0.1 verify:runner | node scripts/verify-runner.mjs | coloringbook-svelte@0.0.1 check | svelte-kit sync && svelte-check --tsconfig ./tsconfig.json
- proof-tape.json (2750 bytes)
- proof-tape.md (867 bytes)
- rewind-SpecValidationSeam.txt (466 bytes)
- seam-ledger.json (10370 bytes)
- seam-ledger.md (1054 bytes)
- shaolin-lint.json (576 bytes)
- test.txt (1090 bytes)
  Commands: coloringbook-svelte@0.0.1 test | vitest run
- verify.txt (1331 bytes)
  Commands: coloringbook-svelte@0.0.1 check | svelte-kit sync && svelte-check --tsconfig ./tsconfig.json | coloringbook-svelte@0.0.1 test | vitest run

