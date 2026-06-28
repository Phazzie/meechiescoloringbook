<!--
Purpose: Summarize evidence artifacts in plain language.
Why: Help non-coders understand proof coverage without reading code.
Info flow: evidence files -> summary -> review.
-->
# Proof Tape

Generated at: 2026-06-28T12:27:38.905Z
Evidence folder: docs/evidence/2026-06-28

Files included:
- assumption-alarm.json (4320 bytes)
- build.txt (8329 bytes)
  Commands: meechies-coloringbook@0.1.0 build | vite build | Using @sveltejs/adapter-vercel
- chamber-lock.json (25709 bytes)
- check.txt (240 bytes)
  Commands: meechies-coloringbook@0.1.0 check | svelte-kit sync && svelte-check --tsconfig ./tsconfig.json
- clan-chain.json (2318 bytes)
- clan-chain.md (1453 bytes)
- lint.txt (48 bytes)
  Commands: meechies-coloringbook@0.1.0 lint | eslint .
- rewind-RateLimitSeam.txt (537 bytes)
- seam-ledger.json (27291 bytes)
- seam-ledger.md (2228 bytes)
- shaolin-lint.json (519 bytes)
- test.txt (1030 bytes)
  Commands: meechies-coloringbook@0.1.0 test | vitest run --pool=forks --maxWorkers=1
- verify.txt (1795 bytes)
  Commands: meechies-coloringbook@0.1.0 check | svelte-kit sync && svelte-check --tsconfig ./tsconfig.json | meechies-coloringbook@0.1.0 test | vitest run --pool=forks --maxWorkers=1 | meechies-coloringbook@0.1.0 shaolin:lint | node scripts/shaolin-lint.mjs | meechies-coloringbook@0.1.0 assumption:alarm | node scripts/assumption-alarm.mjs | meechies-coloringbook@0.1.0 seam:ledger | node scripts/seam-ledger.mjs | meechies-coloringbook@0.1.0 clan:chain | node scripts/clan-chain.mjs | meechies-coloringbook@0.1.0 proof:tape | node scripts/proof-tape.mjs
