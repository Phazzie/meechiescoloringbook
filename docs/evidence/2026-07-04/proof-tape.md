<!--
Purpose: Summarize evidence artifacts in plain language.
Why: Help non-coders understand proof coverage without reading code.
Info flow: evidence files -> summary -> review.
-->
# Proof Tape

Generated at: 2026-07-04T10:18:09.440Z
Evidence folder: docs/evidence/2026-07-04

Files included:
- assumption-alarm.json (3636 bytes)
- chamber-lock.json (26724 bytes)
- check.txt (401 bytes)
  Commands: meechies-coloringbook@0.1.0 check | svelte-kit sync && svelte-check --tsconfig ./tsconfig.json
- cipher-gate.json (1527 bytes)
- clan-chain.json (2389 bytes)
- clan-chain.md (1488 bytes)
- lint.txt (228 bytes)
  Commands: meechies-coloringbook@0.1.0 lint | eslint .
- pr202-pr204-focused-tests.txt (566 bytes)
- pr214-review-followup-focused-tests.txt (566 bytes)
- proof-tape.json (4263 bytes)
- proof-tape.md (1463 bytes)
- rewind-ProviderAdapterSeam-followup.txt (629 bytes)
  Commands: meechies-coloringbook@0.1.0 rewind | node scripts/rewind.mjs --seam ProviderAdapterSeam
- rewind-ProviderAdapterSeam.txt (540 bytes)
- rewind-RateLimitConfigSeam.txt (627 bytes)
  Commands: meechies-coloringbook@0.1.0 rewind | node scripts/rewind.mjs --seam RateLimitConfigSeam
- rewind-RateLimitSeam.txt (618 bytes)
  Commands: meechies-coloringbook@0.1.0 rewind | node scripts/rewind.mjs --seam RateLimitSeam
- seam-ledger.json (28354 bytes)
- seam-ledger.md (2294 bytes)
- shaolin-lint.json (517 bytes)
- test.txt (1010 bytes)
  Commands: meechies-coloringbook@0.1.0 test | vitest run --pool=forks --maxWorkers=1
- verify.txt (1269 bytes)
  Commands: meechies-coloringbook@0.1.0 check | svelte-kit sync && svelte-check --tsconfig ./tsconfig.json | meechies-coloringbook@0.1.0 test | vitest run --pool=forks --maxWorkers=1
