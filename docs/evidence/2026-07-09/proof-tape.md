<!--
Purpose: Summarize evidence artifacts in plain language.
Why: Help non-coders understand proof coverage without reading code.
Info flow: evidence files -> summary -> review.
-->
# Proof Tape

Generated at: 2026-07-09T12:18:44.960Z
Evidence folder: docs/evidence/2026-07-09

Files included:
- assumption-alarm.json (4558 bytes)
- chamber-lock.json (25720 bytes)
- cipher-gate.json (1661 bytes)
- clan-chain.json (2318 bytes)
- clan-chain.md (1453 bytes)
- proof-tape.json (2439 bytes)
- proof-tape.md (879 bytes)
- rewind-RateLimitSeam.txt (537 bytes)
- seam-ledger.json (27309 bytes)
- seam-ledger.md (2228 bytes)
- shaolin-lint.json (519 bytes)
- test.txt (1029 bytes)
  Commands: meechies-coloringbook@0.1.0 test | vitest run --pool=forks --maxWorkers=1
- verify.txt (1288 bytes)
  Commands: meechies-coloringbook@0.1.0 check | svelte-kit sync && svelte-check --tsconfig ./tsconfig.json | meechies-coloringbook@0.1.0 test | vitest run --pool=forks --maxWorkers=1
