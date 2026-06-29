<!--
Purpose: Summarize evidence artifacts in plain language.
Why: Help non-coders understand proof coverage without reading code.
Info flow: evidence files -> summary -> review.
-->
# Proof Tape

Generated at: 2026-06-29T10:32:41.206Z
Evidence folder: docs/evidence/2026-06-29

Files included:
- assumption-alarm.json (3636 bytes)
- chamber-lock.json (26724 bytes)
- check.txt (438 bytes)
  Commands: meechies-coloringbook@0.1.0 check | svelte-kit sync && svelte-check --tsconfig ./tsconfig.json
- cipher-gate.json (1735 bytes)
- clan-chain.json (2389 bytes)
- clan-chain.md (1488 bytes)
- lint.txt (244 bytes)
  Commands: meechies-coloringbook@0.1.0 lint | eslint .
- pr198-focused-tests.txt (844 bytes)
- proof-tape.json (2224 bytes)
- proof-tape.md (840 bytes)
- rewind-ImageGenerationSeam.txt (540 bytes)
- rewind-ProviderAdapterSeam.txt (540 bytes)
- seam-ledger.json (28354 bytes)
- seam-ledger.md (2294 bytes)
- shaolin-lint.json (518 bytes)
- test.txt (1010 bytes)
  Commands: meechies-coloringbook@0.1.0 test | vitest run --pool=forks --maxWorkers=1
- verify.txt (1269 bytes)
  Commands: meechies-coloringbook@0.1.0 check | svelte-kit sync && svelte-check --tsconfig ./tsconfig.json | meechies-coloringbook@0.1.0 test | vitest run --pool=forks --maxWorkers=1
