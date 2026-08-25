<!--
Purpose: Summarize evidence artifacts in plain language.
Why: Help non-coders understand proof coverage without reading code.
Info flow: evidence files -> summary -> review.
-->
# Proof Tape

Generated at: 2026-07-05T12:23:29.305Z
Evidence folder: docs/evidence/2026-07-05

Files included:
- assumption-alarm.json (3636 bytes)
- chamber-lock.json (24795 bytes)
- clan-chain.json (2247 bytes)
- clan-chain.md (1418 bytes)
- proof-tape.json (4792 bytes)
- proof-tape.md (2171 bytes)
- quick-wins-check.txt (240 bytes)
  Commands: meechies-coloringbook@0.1.0 check | svelte-kit sync && svelte-check --tsconfig ./tsconfig.json
- quick-wins-lint.txt (48 bytes)
  Commands: meechies-coloringbook@0.1.0 lint | eslint .
- quick-wins-test.txt (781 bytes)
  Commands: meechies-coloringbook@0.1.0 test | vitest run
- quick-wins-verify.txt (1794 bytes)
  Commands: meechies-coloringbook@0.1.0 verify | npm run chamber:lock && npm run verify:runner && npm run shaolin:lint && npm run assumption:alarm && npm run seam:ledger && npm run clan:chain && npm run proof:tape | meechies-coloringbook@0.1.0 chamber:lock | node scripts/chamber-lock.mjs | meechies-coloringbook@0.1.0 verify:runner | node scripts/verify-runner.mjs | meechies-coloringbook@0.1.0 check | svelte-kit sync && svelte-check --tsconfig ./tsconfig.json | meechies-coloringbook@0.1.0 test | vitest run --pool=forks --maxWorkers=1 | meechies-coloringbook@0.1.0 shaolin:lint | node scripts/shaolin-lint.mjs | meechies-coloringbook@0.1.0 assumption:alarm | node scripts/assumption-alarm.mjs | meechies-coloringbook@0.1.0 seam:ledger | node scripts/seam-ledger.mjs | meechies-coloringbook@0.1.0 clan:chain | node scripts/clan-chain.mjs | meechies-coloringbook@0.1.0 proof:tape | node scripts/proof-tape.mjs
- seam-ledger.json (26323 bytes)
- seam-ledger.md (2168 bytes)
- shaolin-lint.json (519 bytes)
- test.txt (1029 bytes)
  Commands: meechies-coloringbook@0.1.0 test | vitest run --pool=forks --maxWorkers=1
- verify.txt (1288 bytes)
  Commands: meechies-coloringbook@0.1.0 check | svelte-kit sync && svelte-check --tsconfig ./tsconfig.json | meechies-coloringbook@0.1.0 test | vitest run --pool=forks --maxWorkers=1
