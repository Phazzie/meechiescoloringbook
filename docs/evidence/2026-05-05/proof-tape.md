<!--
Purpose: Summarize evidence artifacts in plain language.
Why: Help non-coders understand proof coverage without reading code.
Info flow: evidence files -> summary -> review.
-->
# Proof Tape

Generated at: 2026-05-05T14:51:49.086Z
Evidence folder: docs/evidence/2026-05-05

Files included:
- assumption-alarm.json (2297 bytes)
- chamber-lock.json (16122 bytes)
- clan-chain.json (1497 bytes)
- clan-chain.md (993 bytes)
- proof-tape.json (2223 bytes)
- proof-tape.md (840 bytes)
- seam-ledger.json (17135 bytes)
- seam-ledger.md (1518 bytes)
- shaolin-lint.json (519 bytes)
- test.txt (3539 bytes)
  Commands: meechies-coloringbook@0.1.0 test | vitest run --pool=forks --maxWorkers=1
- verify.txt (3798 bytes)
  Commands: meechies-coloringbook@0.1.0 check | svelte-kit sync && svelte-check --tsconfig ./tsconfig.json | meechies-coloringbook@0.1.0 test | vitest run --pool=forks --maxWorkers=1
