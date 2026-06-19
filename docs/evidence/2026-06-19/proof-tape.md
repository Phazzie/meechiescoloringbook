<!--
Purpose: Summarize evidence artifacts in plain language.
Why: Help non-coders understand proof coverage without reading code.
Info flow: evidence files -> summary -> review.
-->
# Proof Tape

Generated at: 2026-06-19T09:50:47.629Z
Evidence folder: docs/evidence/2026-06-19

Files included:
- assumption-alarm.json (4573 bytes)
- build.txt (8510 bytes)
  Commands: meechies-coloringbook@0.1.0 build | vite build | Using @sveltejs/adapter-vercel
- chamber-lock.json (25681 bytes)
- check.txt (421 bytes)
  Commands: meechies-coloringbook@0.1.0 check | svelte-kit sync && svelte-check --tsconfig ./tsconfig.json
- cipher-gate.json (1584 bytes)
- clan-chain.json (2315 bytes)
- clan-chain.md (1450 bytes)
- lint.txt (228 bytes)
  Commands: meechies-coloringbook@0.1.0 lint | eslint .
- proof-tape.json (2224 bytes)
- proof-tape.md (840 bytes)
- rewind-RateLimitSeam.txt (540 bytes)
- seam-ledger.json (27260 bytes)
- seam-ledger.md (2228 bytes)
- shaolin-lint.json (519 bytes)
- targeted-tests.txt (589 bytes)
- test.txt (1030 bytes)
  Commands: meechies-coloringbook@0.1.0 test | vitest run --pool=forks --maxWorkers=1
- verify.txt (1289 bytes)
  Commands: meechies-coloringbook@0.1.0 check | svelte-kit sync && svelte-check --tsconfig ./tsconfig.json | meechies-coloringbook@0.1.0 test | vitest run --pool=forks --maxWorkers=1
