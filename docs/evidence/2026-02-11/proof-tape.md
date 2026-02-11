<!--
Purpose: Summarize evidence artifacts in plain language.
Why: Help non-coders understand proof coverage without reading code.
Info flow: evidence files -> summary -> review.
-->
# Proof Tape

Generated at: 2026-02-11T22:43:13.863Z
Evidence folder: docs/evidence/2026-02-11

Files included:
- assumption-alarm.json (2297 bytes)
- chamber-lock.json (10647 bytes)
- cipher-gate.json (1732 bytes)
- clan-chain.json (1161 bytes)
- clan-chain.md (821 bytes)
- npm-test.txt (749 bytes)
  Commands: meechies-coloringbook@0.1.0 test | vitest run
- npm-verify.txt (1755 bytes)
  Commands: meechies-coloringbook@0.1.0 verify | npm run chamber:lock && npm run verify:runner && npm run shaolin:lint && npm run assumption:alarm && npm run seam:ledger && npm run clan:chain && npm run proof:tape && npm run cipher:gate | meechies-coloringbook@0.1.0 chamber:lock | node scripts/chamber-lock.mjs | meechies-coloringbook@0.1.0 verify:runner | node scripts/verify-runner.mjs | meechies-coloringbook@0.1.0 check | svelte-kit sync && svelte-check --tsconfig ./tsconfig.json | meechies-coloringbook@0.1.0 test | vitest run | meechies-coloringbook@0.1.0 shaolin:lint | node scripts/shaolin-lint.mjs | meechies-coloringbook@0.1.0 assumption:alarm | node scripts/assumption-alarm.mjs | meechies-coloringbook@0.1.0 seam:ledger | node scripts/seam-ledger.mjs | meechies-coloringbook@0.1.0 clan:chain | node scripts/clan-chain.mjs | meechies-coloringbook@0.1.0 proof:tape | node scripts/proof-tape.mjs
- probe-image-generation.txt (82 bytes)
- probe-provider-adapter.txt (78 bytes)
- proof-tape.json (4736 bytes)
- proof-tape.md (1977 bytes)
- seam-ledger.json (11348 bytes)
- seam-ledger.md (1112 bytes)
- shaolin-lint.json (578 bytes)
- test.txt (925 bytes)
  Commands: meechies-coloringbook@0.1.0 test | vitest run
- verify.txt (1168 bytes)
  Commands: meechies-coloringbook@0.1.0 check | svelte-kit sync && svelte-check --tsconfig ./tsconfig.json | meechies-coloringbook@0.1.0 test | vitest run

