<!--
Purpose: Summarize evidence artifacts in plain language.
Why: Help non-coders understand proof coverage without reading code.
Info flow: evidence files -> summary -> review.
-->
# Proof Tape

Generated at: 2026-09-06T00:46:04.069Z
Evidence folder: docs/evidence/2026-09-06

Files included (this tape's own outputs, proof-tape.json and proof-tape.md, are written
after this inventory is taken, so they are not listed):

- assumption-alarm.json (12123 bytes)
- build.txt (11225 bytes)
  Commands: meechies-coloringbook@0.1.0 build | vite build | Using @sveltejs/adapter-vercel
- chamber-lock.json (35321 bytes)
- clan-chain.json (3181 bytes)
- clan-chain.md (1956 bytes)
- e2e.txt (5632 bytes)
  Commands: meechies-coloringbook@0.1.0 test:e2e | playwright test
- lint.txt (55 bytes)
  Commands: meechies-coloringbook@0.1.0 lint | eslint .
- rewind-DriftDetectionSeam(self-contained).txt (539 bytes)
- rewind-DriftDetectionSeam-self-contained.txt (473 bytes)
  Commands: meechies-coloringbook@0.1.0 rewind | node scripts/rewind.mjs --seam DriftDetectionSeam (self-contained)
- seam-ledger.json (37460 bytes)
- seam-ledger.md (2981 bytes)
- shaolin-lint.json (518 bytes)
- test.txt (3131 bytes)
  Commands: meechies-coloringbook@0.1.0 test | vitest run --pool=forks --maxWorkers=1
- verify-outer.txt (3547 bytes)
  Commands: meechies-coloringbook@0.1.0 verify | npm run audit:gate && node scripts/chamber-lock.mjs && node scripts/verify-runner.mjs && node scripts/shaolin-lint.mjs && node scripts/assumption-alarm.mjs && node scripts/seam-ledger.mjs && node scripts/clan-chain.mjs && node scripts/proof-tape.mjs | meechies-coloringbook@0.1.0 audit:gate | npm audit --audit-level=high | meechies-coloringbook@0.1.0 check | svelte-kit sync && svelte-check --tsconfig ./tsconfig.json | meechies-coloringbook@0.1.0 test | vitest run --pool=forks --maxWorkers=1
- verify.txt (3456 bytes)
  Commands: meechies-coloringbook@0.1.0 check | svelte-kit sync && svelte-check --tsconfig ./tsconfig.json | meechies-coloringbook@0.1.0 test | vitest run --pool=forks --maxWorkers=1
