<!--
Purpose: Summarize evidence artifacts in plain language.
Why: Help non-coders understand proof coverage without reading code.
Info flow: evidence files -> summary -> review.
-->
# Proof Tape

Generated at: 2026-07-05T09:58:51.835Z
Evidence folder: docs/evidence/2026-07-05

Files included:
- assumption-alarm.json (3636 bytes)
- chamber-lock.json (26724 bytes)
- cipher-gate.json (1735 bytes)
- clan-chain.json (2389 bytes)
- clan-chain.md (1488 bytes)
- proof-tape.json (2815 bytes)
- proof-tape.md (931 bytes)
- seam-ledger.json (28354 bytes)
- seam-ledger.md (2294 bytes)
- shaolin-lint.json (517 bytes)
- test.txt (1010 bytes)
  Commands: meechies-coloringbook@0.1.0 test | vitest run --pool=forks --maxWorkers=1
- verify.txt (1269 bytes)
  Commands: meechies-coloringbook@0.1.0 check | svelte-kit sync && svelte-check --tsconfig ./tsconfig.json | meechies-coloringbook@0.1.0 test | vitest run --pool=forks --maxWorkers=1
