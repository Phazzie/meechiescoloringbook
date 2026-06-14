<!--
Purpose: Summarize evidence artifacts in plain language.
Why: Help non-coders understand proof coverage without reading code.
Info flow: evidence files -> summary -> review.
-->
# Proof Tape

Generated at: 2026-06-14T12:20:55.745Z
Evidence folder: docs/evidence/2026-06-14

Files included:
- assumption-alarm.json (3636 bytes)
- chamber-lock.json (20510 bytes)
- clan-chain.json (1872 bytes)
- clan-chain.md (1223 bytes)
- seam-ledger.json (21768 bytes)
- seam-ledger.md (1848 bytes)
- shaolin-lint.json (518 bytes)
- test.txt (1029 bytes)
  Commands: meechies-coloringbook@0.1.0 test | vitest run --pool=forks --maxWorkers=1
- verify.txt (1288 bytes)
  Commands: meechies-coloringbook@0.1.0 check | svelte-kit sync && svelte-check --tsconfig ./tsconfig.json | meechies-coloringbook@0.1.0 test | vitest run --pool=forks --maxWorkers=1
