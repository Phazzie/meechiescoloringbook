<!--
Purpose: Summarize evidence artifacts in plain language.
Why: Help non-coders understand proof coverage without reading code.
Info flow: evidence files -> summary -> review.
-->
# Proof Tape

Generated at: 2026-07-01T10:13:12.028Z
Evidence folder: docs/evidence/2026-07-01

Files included:
- assumption-alarm.json (3636 bytes)
- chamber-lock.json (26724 bytes)
- check.txt (220 bytes)
  Commands: meechies-coloringbook@0.1.0 check | svelte-kit sync && svelte-check --tsconfig ./tsconfig.json
- cipher-gate.json (1389 bytes)
- clan-chain.json (2389 bytes)
- clan-chain.md (1488 bytes)
- lint.txt (48 bytes)
  Commands: meechies-coloringbook@0.1.0 lint | eslint .
- proof-tape.json (2224 bytes)
- proof-tape.md (840 bytes)
- rewind-RateLimitConfigSeam.txt (537 bytes)
- rewind-RateLimitSeam.txt (541 bytes)
- seam-ledger.json (28354 bytes)
- seam-ledger.md (2294 bytes)
- shaolin-lint.json (519 bytes)
- test.txt (1010 bytes)
  Commands: meechies-coloringbook@0.1.0 test | vitest run --pool=forks --maxWorkers=1
- verify.txt (1269 bytes)
  Commands: meechies-coloringbook@0.1.0 check | svelte-kit sync && svelte-check --tsconfig ./tsconfig.json | meechies-coloringbook@0.1.0 test | vitest run --pool=forks --maxWorkers=1
