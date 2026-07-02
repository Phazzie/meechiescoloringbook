<!--
Purpose: Summarize evidence artifacts in plain language.
Why: Help non-coders understand proof coverage without reading code.
Info flow: evidence files -> summary -> review.
-->
# Proof Tape

Generated at: 2026-07-02T12:35:29.103Z
Evidence folder: docs/evidence/2026-07-02

Files included:
- assumption-alarm.json (3636 bytes)
- chamber-lock.json (25709 bytes)
- cipher-gate.json (1555 bytes)
- clan-chain.json (2318 bytes)
- clan-chain.md (1453 bytes)
- proof-tape.json (3030 bytes)
- proof-tape.md (970 bytes)
- rewind-RateLimitSeam.txt (540 bytes)
- seam-ledger.json (27291 bytes)
- seam-ledger.md (2228 bytes)
- shaolin-lint.json (519 bytes)
- test.txt (1029 bytes)
  Commands: meechies-coloringbook@0.1.0 test | vitest run --pool=forks --maxWorkers=1
- verify.txt (1288 bytes)
  Commands: meechies-coloringbook@0.1.0 check | svelte-kit sync && svelte-check --tsconfig ./tsconfig.json | meechies-coloringbook@0.1.0 test | vitest run --pool=forks --maxWorkers=1
