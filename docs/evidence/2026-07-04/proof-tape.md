<!--
Purpose: Summarize evidence artifacts in plain language.
Why: Help non-coders understand proof coverage without reading code.
Info flow: evidence files -> summary -> review.
-->
# Proof Tape

Generated at: 2026-07-04T12:24:00.966Z
Evidence folder: docs/evidence/2026-07-04

Files included:
- assumption-alarm.json (3636 bytes)
- chamber-lock.json (20425 bytes)
- cipher-gate.json (1771 bytes)
- clan-chain.json (1787 bytes)
- clan-chain.md (1138 bytes)
- proof-tape.json (2224 bytes)
- proof-tape.md (840 bytes)
- seam-consolidation-build.txt (8329 bytes)
  Commands: meechies-coloringbook@0.1.0 build | vite build | Using @sveltejs/adapter-vercel
- seam-consolidation-check.txt (240 bytes)
  Commands: meechies-coloringbook@0.1.0 check | svelte-kit sync && svelte-check --tsconfig ./tsconfig.json
- seam-consolidation-diff-check.txt (0 bytes)
- seam-consolidation-lint.txt (48 bytes)
  Commands: meechies-coloringbook@0.1.0 lint | eslint .
- seam-consolidation-test.txt (782 bytes)
  Commands: meechies-coloringbook@0.1.0 test | vitest run
- seam-ledger.json (21683 bytes)
- seam-ledger.md (1763 bytes)
- shaolin-lint.json (519 bytes)
- test.txt (1029 bytes)
  Commands: meechies-coloringbook@0.1.0 test | vitest run --pool=forks --maxWorkers=1
- verify.txt (1288 bytes)
  Commands: meechies-coloringbook@0.1.0 check | svelte-kit sync && svelte-check --tsconfig ./tsconfig.json | meechies-coloringbook@0.1.0 test | vitest run --pool=forks --maxWorkers=1
