<!--
Purpose: Summarize evidence artifacts in plain language.
Why: Help non-coders understand proof coverage without reading code.
Info flow: evidence files -> summary -> review.
-->
# Proof Tape

Generated at: 2026-06-19T12:36:07.490Z
Evidence folder: docs/evidence/2026-06-19

Files included:
- assumption-alarm.json (3636 bytes)
- build.txt (8422 bytes)
  Commands: meechies-coloringbook@0.1.0 build | vite build | Using @sveltejs/adapter-vercel
- chamber-lock.json (25720 bytes)
- check.txt (240 bytes)
  Commands: meechies-coloringbook@0.1.0 check | svelte-kit sync && svelte-check --tsconfig ./tsconfig.json
- cipher-gate.json (1594 bytes)
- clan-chain.json (2315 bytes)
- clan-chain.md (1450 bytes)
- diff-check.txt (7 bytes)
- lint.txt (47 bytes)
  Commands: meechies-coloringbook@0.1.0 lint | eslint .
- proof-tape.json (4083 bytes)
- proof-tape.md (1324 bytes)
- rewind-RateLimitSeam.txt (536 bytes)
- seam-ledger.json (27299 bytes)
- seam-ledger.md (2228 bytes)
- shaolin-lint.json (519 bytes)
- test.txt (1029 bytes)
  Commands: meechies-coloringbook@0.1.0 test | vitest run --pool=forks --maxWorkers=1
- verify.txt (1288 bytes)
  Commands: meechies-coloringbook@0.1.0 check | svelte-kit sync && svelte-check --tsconfig ./tsconfig.json | meechies-coloringbook@0.1.0 test | vitest run --pool=forks --maxWorkers=1
