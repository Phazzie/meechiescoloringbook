<!--
Purpose: Summarize evidence artifacts in plain language.
Why: Help non-coders understand proof coverage without reading code.
Info flow: evidence files -> summary -> review.
-->
# Proof Tape

Generated at: 2026-06-17T12:27:35.486Z
Evidence folder: docs/evidence/2026-06-17

Files included:
- assumption-alarm.json (3636 bytes)
- build.txt (8422 bytes)
  Commands: meechies-coloringbook@0.1.0 build | vite build | Using @sveltejs/adapter-vercel
- chamber-lock.json (25709 bytes)
- check.txt (240 bytes)
  Commands: meechies-coloringbook@0.1.0 check | svelte-kit sync && svelte-check --tsconfig ./tsconfig.json
- clan-chain.json (2315 bytes)
- clan-chain.md (1450 bytes)
- lint.txt (48 bytes)
  Commands: meechies-coloringbook@0.1.0 lint | eslint .
- proof-tape.json (2224 bytes)
- proof-tape.md (840 bytes)
- rate-limit-guard-targeted-test.txt (356 bytes)
- rewind-RateLimitSeam.txt (539 bytes)
- seam-ledger.json (27288 bytes)
- seam-ledger.md (2228 bytes)
- shaolin-lint.json (519 bytes)
- test.txt (1030 bytes)
  Commands: meechies-coloringbook@0.1.0 test | vitest run --pool=forks --maxWorkers=1
- verify.txt (1289 bytes)
  Commands: meechies-coloringbook@0.1.0 check | svelte-kit sync && svelte-check --tsconfig ./tsconfig.json | meechies-coloringbook@0.1.0 test | vitest run --pool=forks --maxWorkers=1
