<!--
Purpose: Summarize evidence artifacts in plain language.
Why: Help non-coders understand proof coverage without reading code.
Info flow: evidence files -> summary -> review.
-->
# Proof Tape

Generated at: 2026-09-03T19:22:21.416Z
Evidence folder: docs\evidence\2026-09-03

Files included (this tape's own outputs, proof-tape.json and proof-tape.md, are written
after this inventory is taken, so they are not listed):

- assumption-alarm.json (9484 bytes)
- build.txt (8987 bytes) — PREDATES THIS VERIFY RUN
  Commands: meechies-coloringbook@0.1.0 build | vite build | Using @sveltejs/adapter-vercel
- chamber-lock.json (25720 bytes)
- cipher-gate.json (1877 bytes) — PREDATES THIS VERIFY RUN
- clan-chain.json (2320 bytes)
- clan-chain.md (1453 bytes)
- evidence-gate-selection-red-proof.txt (7102 bytes) — PREDATES THIS VERIFY RUN
- lint.txt (314 bytes) — PREDATES THIS VERIFY RUN
  Commands: meechies-coloringbook@0.1.0 lint | eslint .
- seam-ledger.json (27312 bytes)
- seam-ledger.md (2228 bytes)
- shaolin-lint.json (518 bytes)
- test.txt (9679 bytes)
  Commands: meechies-coloringbook@0.1.0 test | vitest run --pool=forks --maxWorkers=1
- verify-chain.txt (2011 bytes) — PREDATES THIS VERIFY RUN
  Commands: meechies-coloringbook@0.1.0 verify | npm run audit:gate && node scripts/chamber-lock.mjs && node scripts/verify-runner.mjs && node scripts/shaolin-lint.mjs && node scripts/assumption-alarm.mjs && node scripts/seam-ledger.mjs && node scripts/clan-chain.mjs && node scripts/proof-tape.mjs | meechies-coloringbook@0.1.0 audit:gate | npm audit --audit-level=high | meechies-coloringbook@0.1.0 check | svelte-kit sync && svelte-check --tsconfig ./tsconfig.json | meechies-coloringbook@0.1.0 test | vitest run --pool=forks --maxWorkers=1
- verify.txt (10014 bytes)
  Commands: meechies-coloringbook@0.1.0 check | svelte-kit sync && svelte-check --tsconfig ./tsconfig.json | meechies-coloringbook@0.1.0 test | vitest run --pool=forks --maxWorkers=1

Older than this run's chamber-lock.json: build.txt, cipher-gate.json, evidence-gate-selection-red-proof.txt, lint.txt, verify-chain.txt.
These files were written by an earlier run, so they describe a different run than
the one this tape summarizes. Regenerate them or read them as history, not as proof
of the current change.
