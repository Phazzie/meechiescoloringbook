<!--
Purpose: Summarize evidence artifacts in plain language.
Why: Help non-coders understand proof coverage without reading code.
Info flow: evidence files -> summary -> review.
-->
# Proof Tape

Generated at: 2026-09-03T01:04:44.833Z
Evidence folder: docs/evidence/2026-09-03

Files included:
- assumption-alarm.json (7034 bytes)
- chamber-lock.json (25720 bytes)
- clan-chain.json (2318 bytes)
- clan-chain.md (1453 bytes)
- proof-tape.json (2224 bytes)
- proof-tape.md (840 bytes)
- seam-ledger.json (27312 bytes)
- seam-ledger.md (2228 bytes)
- shaolin-lint.json (516 bytes)
- test.txt (1029 bytes)
  Commands: meechies-coloringbook@0.1.0 test | vitest run --pool=forks --maxWorkers=1
- verify.txt (1354 bytes)
  Commands: meechies-coloringbook@0.1.0 check | svelte-kit sync && svelte-check --tsconfig ./tsconfig.json | meechies-coloringbook@0.1.0 test | vitest run --pool=forks --maxWorkers=1
