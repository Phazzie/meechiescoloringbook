<!--
Purpose: Summarize evidence artifacts in plain language.
Why: Help non-coders understand proof coverage without reading code.
Info flow: evidence files -> summary -> review.
-->
# Proof Tape

Generated at: 2026-06-27T16:20:11.655Z
Evidence folder: docs/evidence/2026-06-27

Files included:
- assumption-alarm.json (3636 bytes)
- chamber-lock.json (24795 bytes)
- check.txt (240 bytes)
  Commands: meechies-coloringbook@0.1.0 check | svelte-kit sync && svelte-check --tsconfig ./tsconfig.json
- cipher-gate.json (1407 bytes)
- circuit-breaker-focused-tests.txt (363 bytes)
- clan-chain.json (2247 bytes)
- clan-chain.md (1418 bytes)
- lint.txt (48 bytes)
  Commands: meechies-coloringbook@0.1.0 lint | eslint .
- proof-tape.json (3833 bytes)
- proof-tape.md (1233 bytes)
- rewind-ProviderAdapterSeam.txt (540 bytes)
- seam-ledger.json (26323 bytes)
- seam-ledger.md (2168 bytes)
- shaolin-lint.json (517 bytes)
- test.txt (1030 bytes)
  Commands: meechies-coloringbook@0.1.0 test | vitest run --pool=forks --maxWorkers=1
- verify.txt (1795 bytes)
  Commands: meechies-coloringbook@0.1.0 check | svelte-kit sync && svelte-check --tsconfig ./tsconfig.json | meechies-coloringbook@0.1.0 test | vitest run --pool=forks --maxWorkers=1 | meechies-coloringbook@0.1.0 shaolin:lint | node scripts/shaolin-lint.mjs | meechies-coloringbook@0.1.0 assumption:alarm | node scripts/assumption-alarm.mjs | meechies-coloringbook@0.1.0 seam:ledger | node scripts/seam-ledger.mjs | meechies-coloringbook@0.1.0 clan:chain | node scripts/clan-chain.mjs | meechies-coloringbook@0.1.0 proof:tape | node scripts/proof-tape.mjs
