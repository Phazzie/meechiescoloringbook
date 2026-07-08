<!--
Purpose: Summarize evidence artifacts in plain language.
Why: Help non-coders understand proof coverage without reading code.
Info flow: evidence files -> summary -> review.
-->
# Proof Tape

Generated at: 2026-07-08T12:32:26.318Z
Evidence folder: docs/evidence/2026-07-08

Files included:
- assumption-alarm.json (4470 bytes)
- chamber-lock.json (25720 bytes)
- clan-chain.json (2318 bytes)
- clan-chain.md (1453 bytes)
- proof-tape.json (2615 bytes)
- proof-tape.md (899 bytes)
- seam-ledger.json (27331 bytes)
- seam-ledger.md (2228 bytes)
- shaolin-lint.json (518 bytes)
- test.txt (1029 bytes)
  Commands: meechies-coloringbook@0.1.0 test | vitest run --pool=forks --maxWorkers=1
- verify.txt (1288 bytes)
  Commands: meechies-coloringbook@0.1.0 check | svelte-kit sync && svelte-check --tsconfig ./tsconfig.json | meechies-coloringbook@0.1.0 test | vitest run --pool=forks --maxWorkers=1
