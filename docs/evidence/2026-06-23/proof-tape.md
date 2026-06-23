<!--
Purpose: Summarize evidence artifacts in plain language.
Why: Help non-coders understand proof coverage without reading code.
Info flow: evidence files -> summary -> review.
-->
# Proof Tape

Generated at: 2026-06-23T10:00:05.358Z
Evidence folder: docs/evidence/2026-06-23

Files included:
- assumption-alarm.json (3636 bytes)
- chamber-lock.json (25709 bytes)
- clan-chain.json (2318 bytes)
- clan-chain.md (1453 bytes)
- rewind-RateLimitSeam.txt (542 bytes)
- seam-ledger.json (27291 bytes)
- seam-ledger.md (2228 bytes)
- shaolin-lint.json (519 bytes)
- test.txt (1030 bytes)
  Commands: meechies-coloringbook@0.1.0 test | vitest run --pool=forks --maxWorkers=1
- verify.txt (1289 bytes)
  Commands: meechies-coloringbook@0.1.0 check | svelte-kit sync && svelte-check --tsconfig ./tsconfig.json | meechies-coloringbook@0.1.0 test | vitest run --pool=forks --maxWorkers=1
