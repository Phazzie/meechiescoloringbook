<!--
Purpose: Summarize evidence artifacts in plain language.
Why: Help non-coders understand proof coverage without reading code.
Info flow: evidence files -> summary -> review.
-->
# Proof Tape

Generated at: 2026-07-06T15:52:28.017Z
Evidence folder: docs/evidence/2026-07-06

Files included:
- assumption-alarm.json (3636 bytes)
- chamber-lock.json (25720 bytes)
- cipher-gate.json (2364 bytes)
- clan-chain.json (2318 bytes)
- clan-chain.md (1453 bytes)
- npm-audit.txt (1991 bytes)
- proof-tape.json (2439 bytes)
- proof-tape.md (879 bytes)
- rate-limit-build.txt (8329 bytes)
  Commands: meechies-coloringbook@0.1.0 build | vite build | Using @sveltejs/adapter-vercel
- rate-limit-check.txt (240 bytes)
  Commands: meechies-coloringbook@0.1.0 check | svelte-kit sync && svelte-check --tsconfig ./tsconfig.json
- rate-limit-lint.txt (48 bytes)
  Commands: meechies-coloringbook@0.1.0 lint | eslint .
- rewind-RateLimitSeam.txt (538 bytes)
- seam-ledger.json (27309 bytes)
- seam-ledger.md (2228 bytes)
- shaolin-lint.json (519 bytes)
- test.txt (1030 bytes)
  Commands: meechies-coloringbook@0.1.0 test | vitest run --pool=forks --maxWorkers=1
- verify.txt (1289 bytes)
  Commands: meechies-coloringbook@0.1.0 check | svelte-kit sync && svelte-check --tsconfig ./tsconfig.json | meechies-coloringbook@0.1.0 test | vitest run --pool=forks --maxWorkers=1
