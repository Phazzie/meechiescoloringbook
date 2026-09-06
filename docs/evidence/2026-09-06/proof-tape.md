<!--
Purpose: Summarize evidence artifacts in plain language.
Why: Help non-coders understand proof coverage without reading code.
Info flow: evidence files -> summary -> review.
-->
# Proof Tape

Generated at: 2026-09-06T07:12:16.653Z
Evidence folder: docs/evidence/2026-09-06

Files included (this tape's own outputs, proof-tape.json and proof-tape.md, are written
after this inventory is taken, so they are not listed):

- assumption-alarm.json (12123 bytes)
- build.txt (12401 bytes) — PREDATES THIS VERIFY RUN
  Commands: meechies-coloringbook@0.1.0 build | vite build | Using @sveltejs/adapter-vercel
- chamber-lock.json (35321 bytes)
- clan-chain.json (3181 bytes)
- clan-chain.md (1956 bytes)
- e2e.txt (6171 bytes) — PREDATES THIS VERIFY RUN
  Commands: meechies-coloringbook@0.1.0 test:e2e | playwright test
- lint.txt (60 bytes) — PREDATES THIS VERIFY RUN
  Commands: meechies-coloringbook@0.1.0 lint | eslint .
- rewind-CacheSeam.txt (555 bytes) — PREDATES THIS VERIFY RUN
- rewind-DriftDetectionSeam(self-contained).txt (539 bytes) — PREDATES THIS VERIFY RUN
- rewind-DriftDetectionSeam-self-contained.txt (473 bytes) — PREDATES THIS VERIFY RUN
  Commands: meechies-coloringbook@0.1.0 rewind | node scripts/rewind.mjs --seam DriftDetectionSeam (self-contained)
- seam-ledger.json (37460 bytes)
- seam-ledger.md (2981 bytes)
- shaolin-lint.json (519 bytes)
- test.txt (3231 bytes)
  Commands: meechies-coloringbook@0.1.0 test | vitest run --pool=forks --maxWorkers=1
- verify-outer.txt (3640 bytes)
  Commands: meechies-coloringbook@0.1.0 verify | npm run audit:gate && node scripts/chamber-lock.mjs && node scripts/verify-runner.mjs && node scripts/shaolin-lint.mjs && node scripts/assumption-alarm.mjs && node scripts/seam-ledger.mjs && node scripts/clan-chain.mjs && node scripts/proof-tape.mjs | meechies-coloringbook@0.1.0 audit:gate | npm audit --audit-level=high | meechies-coloringbook@0.1.0 check | svelte-kit sync && svelte-check --tsconfig ./tsconfig.json | meechies-coloringbook@0.1.0 test | vitest run --pool=forks --maxWorkers=1
- verify.txt (3556 bytes)
  Commands: meechies-coloringbook@0.1.0 check | svelte-kit sync && svelte-check --tsconfig ./tsconfig.json | meechies-coloringbook@0.1.0 test | vitest run --pool=forks --maxWorkers=1

Older than this run's chamber-lock.json: build.txt, e2e.txt, lint.txt, rewind-CacheSeam.txt, rewind-DriftDetectionSeam(self-contained).txt, rewind-DriftDetectionSeam-self-contained.txt.
These files were written by an earlier run, so they describe a different run than
the one this tape summarizes. Regenerate them or read them as history, not as proof
of the current change.
