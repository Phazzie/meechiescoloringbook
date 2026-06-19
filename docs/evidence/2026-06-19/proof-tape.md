<!--
Purpose: Summarize evidence artifacts in plain language.
Why: Help non-coders understand proof coverage without reading code.
Info flow: evidence files -> summary -> review.
-->
# Proof Tape

Generated at: 2026-06-19T10:13:46.774Z
Evidence folder: docs/evidence/2026-06-19

Files included:
- assumption-alarm.json (4573 bytes)
- build.txt (8329 bytes)
  Commands: meechies-coloringbook@0.1.0 build | vite build | Using @sveltejs/adapter-vercel
- chamber-lock.json (25681 bytes)
- check.txt (240 bytes)
  Commands: meechies-coloringbook@0.1.0 check | svelte-kit sync && svelte-check --tsconfig ./tsconfig.json
- cipher-gate.json (1584 bytes)
- clan-chain.json (2315 bytes)
- clan-chain.md (1450 bytes)
- lint.txt (48 bytes)
  Commands: meechies-coloringbook@0.1.0 lint | eslint .
- proof-tape.json (4093 bytes)
- proof-tape.md (1330 bytes)
- rewind-RateLimitSeam.txt (540 bytes)
- seam-ledger.json (27260 bytes)
- seam-ledger.md (2228 bytes)
- shaolin-lint.json (518 bytes)
- targeted-tests.txt (365 bytes)
- test.txt (1030 bytes)
  Commands: meechies-coloringbook@0.1.0 test | vitest run --pool=forks --maxWorkers=1
- verify.txt (1289 bytes)
  Commands: meechies-coloringbook@0.1.0 check | svelte-kit sync && svelte-check --tsconfig ./tsconfig.json | meechies-coloringbook@0.1.0 test | vitest run --pool=forks --maxWorkers=1
