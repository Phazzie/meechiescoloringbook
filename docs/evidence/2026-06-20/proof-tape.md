<!--
Purpose: Summarize evidence artifacts in plain language.
Why: Help non-coders understand proof coverage without reading code.
Info flow: evidence files -> summary -> review.
-->
# Proof Tape

Generated at: 2026-06-20T12:25:13.433Z
Evidence folder: docs/evidence/2026-06-20

Files included:
- assumption-alarm.json (3636 bytes)
- build.txt (8342 bytes)
  Commands: meechies-coloringbook@0.1.0 build | vite build | Using @sveltejs/adapter-vercel
- chamber-lock.json (24795 bytes)
- clan-chain.json (2247 bytes)
- clan-chain.md (1418 bytes)
- lint.txt (60 bytes)
  Commands: meechies-coloringbook@0.1.0 lint | eslint .
- proof-tape.json (2224 bytes)
- proof-tape.md (840 bytes)
- seam-ledger.json (26323 bytes)
- seam-ledger.md (2168 bytes)
- shaolin-lint.json (518 bytes)
- test.txt (1029 bytes)
  Commands: meechies-coloringbook@0.1.0 test | vitest run --pool=forks --maxWorkers=1
- verify.txt (1288 bytes)
  Commands: meechies-coloringbook@0.1.0 check | svelte-kit sync && svelte-check --tsconfig ./tsconfig.json | meechies-coloringbook@0.1.0 test | vitest run --pool=forks --maxWorkers=1
