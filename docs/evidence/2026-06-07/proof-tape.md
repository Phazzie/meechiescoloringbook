<!--
Purpose: Summarize evidence artifacts in plain language.
Why: Help non-coders understand proof coverage without reading code.
Info flow: evidence files -> summary -> review.
-->
# Proof Tape

Generated at: 2026-06-07T06:01:36.348Z
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
- cipher-gate.json (1474 bytes)
- clan-chain.json (2343 bytes)
- clan-chain.md (1476 bytes)
- e2e-smoke.txt (814 bytes)
  Commands: meechies-coloringbook@0.1.0 test:e2e | playwright test
- lint.txt (47 bytes)
  Commands: meechies-coloringbook@0.1.0 lint | eslint .
- open-prs-after-contained-close.json (14595 bytes)
- open-prs-after-main-push.json (16555 bytes)
- open-prs-after-pr120-merge.json (14105 bytes)
- open-prs-after-recalc.json (14017 bytes)
- open-prs-current.json (17625 bytes)
- pr-117-check.txt (530 bytes)
- pr-117-diff-check.txt (1688 bytes)
- pr-117-lint.txt (106 bytes)
- pr-117-selfie-upload-focused-tests.txt (1228 bytes)
- pr-117-selfie-upload-red.txt (636 bytes)
- pr-117-verify.txt (20736 bytes)
- pr-133-check.txt (254 bytes)
  Commands: meechies-coloringbook@0.1.0 check | svelte-kit sync && svelte-check --tsconfig ./tsconfig.json
- pr-133-cipher-gate-wrapper.txt (75 bytes)
  Commands: meechies-coloringbook@0.1.0 cipher:gate | node scripts/cipher-gate.mjs
- pr-133-diff-check.txt (1933 bytes)
- pr-133-focused-tests.txt (2220 bytes)
  Commands: meechies-coloringbook@0.1.0 test | vitest run tests/unit/output-packaging-helpers.test.ts tests/contract/output-packaging.test.ts tests/unit/api-wig-try-on.test.ts tests/unit/http-client.test.ts tests/unit/meechie-studio-text-pipeline.test.ts --pool=forks --maxWorkers=1
- pr-133-lint.txt (48 bytes)
  Commands: meechies-coloringbook@0.1.0 lint | eslint .
- pr-133-print-dimension-debt-after.txt (59 bytes)
- pr-133-print-dimension-debt-before.txt (166 bytes)
- pr-133-verify-wrapper.txt (10121 bytes)
  Commands: meechies-coloringbook@0.1.0 verify | npm run chamber:lock && npm run verify:runner && npm run shaolin:lint && npm run assumption:alarm && npm run seam:ledger && npm run clan:chain && npm run proof:tape | meechies-coloringbook@0.1.0 chamber:lock | node scripts/chamber-lock.mjs | meechies-coloringbook@0.1.0 verify:runner | node scripts/verify-runner.mjs | meechies-coloringbook@0.1.0 check | svelte-kit sync && svelte-check --tsconfig ./tsconfig.json | meechies-coloringbook@0.1.0 test | vitest run --pool=forks --maxWorkers=1 | meechies-coloringbook@0.1.0 shaolin:lint | node scripts/shaolin-lint.mjs | meechies-coloringbook@0.1.0 assumption:alarm | node scripts/assumption-alarm.mjs | meechies-coloringbook@0.1.0 seam:ledger | node scripts/seam-ledger.mjs | meechies-coloringbook@0.1.0 clan:chain | node scripts/clan-chain.mjs | meechies-coloringbook@0.1.0 proof:tape | node scripts/proof-tape.mjs
- pr-136-check.txt (530 bytes)
- pr-136-http-client-focused-tests.txt (1222 bytes)
- pr-136-http-client-red.txt (12072 bytes)
- pr-136-lint.txt (106 bytes)
- pr-136-verify.txt (20456 bytes)
- pr-139-check.txt (255 bytes)
  Commands: meechies-coloringbook@0.1.0 check | svelte-kit sync && svelte-check --tsconfig ./tsconfig.json
- pr-139-cipher-gate-wrapper.txt (74 bytes)
  Commands: meechies-coloringbook@0.1.0 cipher:gate | node scripts/cipher-gate.mjs
- pr-139-diff-check.txt (2170 bytes)
- pr-139-focused-tests.txt (1073 bytes)
  Commands: meechies-coloringbook@0.1.0 test | vitest run tests/unit/coloring-page-title.test.ts tests/unit/http-resilience.test.ts tests/unit/text-model.test.ts tests/unit/meechie-studio-text-pipeline.test.ts --pool=forks --maxWorkers=1
- pr-139-full-test.txt (9123 bytes)
  Commands: meechies-coloringbook@0.1.0 test | vitest run --pool=forks --maxWorkers=1
- pr-139-lint.txt (47 bytes)
  Commands: meechies-coloringbook@0.1.0 lint | eslint .
- pr-139-proof-tape-wrapper.txt (72 bytes)
  Commands: meechies-coloringbook@0.1.0 proof:tape | node scripts/proof-tape.mjs
- pr-139-verify-runner-wrapper.txt (9455 bytes)
  Commands: meechies-coloringbook@0.1.0 verify:runner | node scripts/verify-runner.mjs | meechies-coloringbook@0.1.0 check | svelte-kit sync && svelte-check --tsconfig ./tsconfig.json | meechies-coloringbook@0.1.0 test | vitest run --pool=forks --maxWorkers=1
- pr-139-verify-wrapper.txt (10121 bytes)
  Commands: meechies-coloringbook@0.1.0 verify | npm run chamber:lock && npm run verify:runner && npm run shaolin:lint && npm run assumption:alarm && npm run seam:ledger && npm run clan:chain && npm run proof:tape | meechies-coloringbook@0.1.0 chamber:lock | node scripts/chamber-lock.mjs | meechies-coloringbook@0.1.0 verify:runner | node scripts/verify-runner.mjs | meechies-coloringbook@0.1.0 check | svelte-kit sync && svelte-check --tsconfig ./tsconfig.json | meechies-coloringbook@0.1.0 test | vitest run --pool=forks --maxWorkers=1 | meechies-coloringbook@0.1.0 shaolin:lint | node scripts/shaolin-lint.mjs | meechies-coloringbook@0.1.0 assumption:alarm | node scripts/assumption-alarm.mjs | meechies-coloringbook@0.1.0 seam:ledger | node scripts/seam-ledger.mjs | meechies-coloringbook@0.1.0 clan:chain | node scripts/clan-chain.mjs | meechies-coloringbook@0.1.0 proof:tape | node scripts/proof-tape.mjs
- pr-containment-after-main-push.json (31669 bytes)
- pr-containment-after-main-push.md (9432 bytes)
- pr-containment-ledger.json (33701 bytes)
- pr-containment-ledger.md (9952 bytes)
- proof-tape-wrapper.txt (72 bytes)
  Commands: meechies-coloringbook@0.1.0 proof:tape | node scripts/proof-tape.mjs
- proof-tape.json (17322 bytes)
- proof-tape.md (7403 bytes)
- seam-ledger.json (27293 bytes)
- seam-ledger.md (2251 bytes)
- shaolin-lint.json (519 bytes)
- studio-state-mode-select.txt (590 bytes)
  Commands: meechies-coloringbook@0.1.0 test | vitest run tests/unit/studio-state.test.ts
- test.txt (9450 bytes)
  Commands: meechies-coloringbook@0.1.0 test | vitest run --pool=forks --maxWorkers=1
- verify-wrapper.txt (10121 bytes)
  Commands: meechies-coloringbook@0.1.0 verify | npm run chamber:lock && npm run verify:runner && npm run shaolin:lint && npm run assumption:alarm && npm run seam:ledger && npm run clan:chain && npm run proof:tape | meechies-coloringbook@0.1.0 chamber:lock | node scripts/chamber-lock.mjs | meechies-coloringbook@0.1.0 verify:runner | node scripts/verify-runner.mjs | meechies-coloringbook@0.1.0 check | svelte-kit sync && svelte-check --tsconfig ./tsconfig.json | meechies-coloringbook@0.1.0 test | vitest run --pool=forks --maxWorkers=1 | meechies-coloringbook@0.1.0 shaolin:lint | node scripts/shaolin-lint.mjs | meechies-coloringbook@0.1.0 assumption:alarm | node scripts/assumption-alarm.mjs | meechies-coloringbook@0.1.0 seam:ledger | node scripts/seam-ledger.mjs | meechies-coloringbook@0.1.0 clan:chain | node scripts/clan-chain.mjs | meechies-coloringbook@0.1.0 proof:tape | node scripts/proof-tape.mjs
- verify.txt (9719 bytes)
  Commands: meechies-coloringbook@0.1.0 check | svelte-kit sync && svelte-check --tsconfig ./tsconfig.json | meechies-coloringbook@0.1.0 test | vitest run --pool=forks --maxWorkers=1
- webp-dedication-focused-tests.txt (1468 bytes)
  Commands: meechies-coloringbook@0.1.0 test | vitest run tests/unit/studio-state.test.ts tests/unit/output-packaging-helpers.test.ts
- whitespace-normalized-files.txt (2460 bytes)
