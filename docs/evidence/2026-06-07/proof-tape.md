<!--
Purpose: Summarize evidence artifacts in plain language.
Why: Help non-coders understand proof coverage without reading code.
Info flow: evidence files -> summary -> review.
-->
# Proof Tape

Generated at: 2026-06-07T03:27:19.249Z
Evidence folder: docs\evidence\2026-06-07

Files included:
- assumption-alarm.json (3636 bytes)
- build.txt (11985 bytes)
  Commands: meechies-coloringbook@0.1.0 build | vite build | Using @sveltejs/adapter-vercel
- chamber-lock.json (25704 bytes)
- check.txt (254 bytes)
  Commands: meechies-coloringbook@0.1.0 check | svelte-kit sync && svelte-check --tsconfig ./tsconfig.json
- cipher-gate-wrapper.txt (74 bytes)
  Commands: meechies-coloringbook@0.1.0 cipher:gate | node scripts/cipher-gate.mjs
- cipher-gate.json (2419 bytes)
- clan-chain.json (2343 bytes)
- clan-chain.md (1476 bytes)
- e2e-smoke.txt (814 bytes)
  Commands: meechies-coloringbook@0.1.0 test:e2e | playwright test
- lint.txt (48 bytes)
  Commands: meechies-coloringbook@0.1.0 lint | eslint .
- proof-tape-wrapper.txt (73 bytes)
  Commands: meechies-coloringbook@0.1.0 proof:tape | node scripts/proof-tape.mjs
- proof-tape.json (6864 bytes)
- proof-tape.md (2901 bytes)
- seam-ledger.json (27293 bytes)
- seam-ledger.md (2251 bytes)
- shaolin-lint.json (519 bytes)
- studio-state-mode-select.txt (590 bytes)
  Commands: meechies-coloringbook@0.1.0 test | vitest run tests/unit/studio-state.test.ts
- test.txt (9342 bytes)
  Commands: meechies-coloringbook@0.1.0 test | vitest run --pool=forks --maxWorkers=1
- verify-wrapper.txt (10121 bytes)
  Commands: meechies-coloringbook@0.1.0 verify | npm run chamber:lock && npm run verify:runner && npm run shaolin:lint && npm run assumption:alarm && npm run seam:ledger && npm run clan:chain && npm run proof:tape | meechies-coloringbook@0.1.0 chamber:lock | node scripts/chamber-lock.mjs | meechies-coloringbook@0.1.0 verify:runner | node scripts/verify-runner.mjs | meechies-coloringbook@0.1.0 check | svelte-kit sync && svelte-check --tsconfig ./tsconfig.json | meechies-coloringbook@0.1.0 test | vitest run --pool=forks --maxWorkers=1 | meechies-coloringbook@0.1.0 shaolin:lint | node scripts/shaolin-lint.mjs | meechies-coloringbook@0.1.0 assumption:alarm | node scripts/assumption-alarm.mjs | meechies-coloringbook@0.1.0 seam:ledger | node scripts/seam-ledger.mjs | meechies-coloringbook@0.1.0 clan:chain | node scripts/clan-chain.mjs | meechies-coloringbook@0.1.0 proof:tape | node scripts/proof-tape.mjs
- verify.txt (9611 bytes)
  Commands: meechies-coloringbook@0.1.0 check | svelte-kit sync && svelte-check --tsconfig ./tsconfig.json | meechies-coloringbook@0.1.0 test | vitest run --pool=forks --maxWorkers=1
- webp-dedication-focused-tests.txt (1468 bytes)
  Commands: meechies-coloringbook@0.1.0 test | vitest run tests/unit/studio-state.test.ts tests/unit/output-packaging-helpers.test.ts
- whitespace-normalized-files.txt (2460 bytes)
