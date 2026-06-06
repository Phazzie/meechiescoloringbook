<!--
Purpose: Summarize evidence artifacts in plain language.
Why: Help non-coders understand proof coverage without reading code.
Info flow: evidence files -> summary -> review.
-->
# Proof Tape

Generated at: 2026-06-05T07:23:58.796Z
Evidence folder: docs\evidence\2026-06-05

Files included:
- assumption-alarm.json (3636 bytes)
- chamber-lock.json (20854 bytes)
- clan-chain.json (1883 bytes)
- clan-chain.md (1197 bytes)
- hpr-baseline-build.txt (27736 bytes)
- hpr-baseline-check.txt (530 bytes)
- hpr-baseline-exit-codes.txt (125 bytes)
- hpr-baseline-lint.txt (193496 bytes)
- hpr-baseline-npm-ci.txt (868 bytes)
- hpr-baseline-test.txt (16666 bytes)
- hpr-http-error-policy-build.txt (13481 bytes)
  Commands: meechies-coloringbook@0.1.0 build | vite build | Using @sveltejs/adapter-vercel
- hpr-http-error-policy-check.txt (254 bytes)
  Commands: meechies-coloringbook@0.1.0 check | svelte-kit sync && svelte-check --tsconfig ./tsconfig.json
- hpr-http-error-policy-green-http-client-threads.txt (603 bytes)
  Commands: meechies-coloringbook@0.1.0 test | vitest run tests/unit/http-client.test.ts --pool=threads --maxWorkers=1
- hpr-http-error-policy-lint.txt (153912 bytes)
  Commands: meechies-coloringbook@0.1.0 lint | eslint .
- hpr-http-error-policy-red-http-client-heap4096.txt (109 bytes)
  Commands: meechies-coloringbook@0.1.0 test | vitest run tests/unit/http-client.test.ts --pool=forks --maxWorkers=1
- hpr-http-error-policy-red-http-client-threads.txt (11571 bytes)
  Commands: meechies-coloringbook@0.1.0 test | vitest run tests/unit/http-client.test.ts --pool=threads --maxWorkers=1
- hpr-http-error-policy-red-http-client.txt (1709 bytes)
  Commands: meechies-coloringbook@0.1.0 test | vitest run tests/unit/http-client.test.ts --pool=forks --maxWorkers=1
- hpr-http-error-policy-targeted-forks.txt (1035 bytes)
  Commands: meechies-coloringbook@0.1.0 test | vitest run tests/unit/http-client.test.ts tests/unit/api-chat-interpretation.test.ts tests/unit/api-tools.test.ts --pool=forks --maxWorkers=1
- hpr-http-error-policy-test.txt (8037 bytes)
  Commands: meechies-coloringbook@0.1.0 test | vitest run
- hpr-http-error-policy-verify-long.txt (9348 bytes)
  Commands: meechies-coloringbook@0.1.0 verify | npm run chamber:lock && npm run verify:runner && npm run shaolin:lint && npm run assumption:alarm && npm run seam:ledger && npm run clan:chain && npm run proof:tape | meechies-coloringbook@0.1.0 chamber:lock | node scripts/chamber-lock.mjs | meechies-coloringbook@0.1.0 verify:runner | node scripts/verify-runner.mjs | meechies-coloringbook@0.1.0 check | svelte-kit sync && svelte-check --tsconfig ./tsconfig.json | meechies-coloringbook@0.1.0 test | vitest run --pool=forks --maxWorkers=1 | meechies-coloringbook@0.1.0 shaolin:lint | node scripts/shaolin-lint.mjs | meechies-coloringbook@0.1.0 assumption:alarm | node scripts/assumption-alarm.mjs | meechies-coloringbook@0.1.0 seam:ledger | node scripts/seam-ledger.mjs | meechies-coloringbook@0.1.0 clan:chain | node scripts/clan-chain.mjs | meechies-coloringbook@0.1.0 proof:tape | node scripts/proof-tape.mjs
- hpr-http-error-policy-verify.txt (9057 bytes)
  Commands: meechies-coloringbook@0.1.0 verify | npm run chamber:lock && npm run verify:runner && npm run shaolin:lint && npm run assumption:alarm && npm run seam:ledger && npm run clan:chain && npm run proof:tape | meechies-coloringbook@0.1.0 chamber:lock | node scripts/chamber-lock.mjs | meechies-coloringbook@0.1.0 verify:runner | node scripts/verify-runner.mjs | meechies-coloringbook@0.1.0 check | svelte-kit sync && svelte-check --tsconfig ./tsconfig.json | meechies-coloringbook@0.1.0 test | vitest run --pool=forks --maxWorkers=1 | meechies-coloringbook@0.1.0 shaolin:lint | node scripts/shaolin-lint.mjs | meechies-coloringbook@0.1.0 assumption:alarm | node scripts/assumption-alarm.mjs | meechies-coloringbook@0.1.0 seam:ledger | node scripts/seam-ledger.mjs | meechies-coloringbook@0.1.0 clan:chain | node scripts/clan-chain.mjs | meechies-coloringbook@0.1.0 proof:tape | node scripts/proof-tape.mjs
- proof-tape.json (8230 bytes)
- proof-tape.md (3506 bytes)
- seam-ledger.json (22173 bytes)
- seam-ledger.md (1847 bytes)
- shaolin-lint.json (518 bytes)
- test.txt (8568 bytes)
  Commands: meechies-coloringbook@0.1.0 test | vitest run --pool=forks --maxWorkers=1
- verify.txt (8837 bytes)
  Commands: meechies-coloringbook@0.1.0 check | svelte-kit sync && svelte-check --tsconfig ./tsconfig.json | meechies-coloringbook@0.1.0 test | vitest run --pool=forks --maxWorkers=1
