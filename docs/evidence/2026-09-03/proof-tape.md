<!--
Purpose: Summarize evidence artifacts in plain language.
Why: Help non-coders understand proof coverage without reading code.
Info flow: evidence files -> summary -> review.
-->
# Proof Tape

Generated at: 2026-09-04T00:04:52.464Z
Evidence folder: docs/evidence/2026-09-03

Files included (this tape's own outputs, proof-tape.json and proof-tape.md, are written
after this inventory is taken, so they are not listed):

- assumption-alarm.json (11519 bytes)
- build.txt (8866 bytes)
  Commands: npm run build | meechies-coloringbook@0.1.0 build | vite build | Using @sveltejs/adapter-vercel | echo "exit=$?"
- chamber-lock.json (25720 bytes)
- cipher-gate.json (1847 bytes) — PREDATES THIS VERIFY RUN
- clan-chain.json (2318 bytes)
- clan-chain.md (1453 bytes)
- evidence-gate-selection-red-proof.txt (6976 bytes) — PREDATES THIS VERIFY RUN
  Commands: touch -d "2026-09-03 05:00:00" docs/evidence/2026-09-03/proof-tape.{json,md} | node scripts/proof-tape.mjs
- lint.txt (300 bytes)
  Commands: npm run lint | meechies-coloringbook@0.1.0 lint | eslint . | echo "exit=$?"
- seam-ledger.json (27312 bytes)
- seam-ledger.md (2228 bytes)
- shaolin-lint.json (519 bytes)
- test.txt (1029 bytes)
  Commands: npm test -- --pool=forks --maxWorkers=1 | meechies-coloringbook@0.1.0 test | vitest run --pool=forks --maxWorkers=1
- verify-chain.txt (2667 bytes)
  Commands: npm run verify | meechies-coloringbook@0.1.0 verify | npm run audit:gate && node scripts/chamber-lock.mjs && node scripts/verify-runner.mjs && node scripts/shaolin-lint.mjs && node scripts/assumption-alarm.mjs && node scripts/seam-ledger.mjs && node scripts/clan-chain.mjs && node scripts/proof-tape.mjs | meechies-coloringbook@0.1.0 audit:gate | npm audit --audit-level=high | meechies-coloringbook@0.1.0 check | svelte-kit sync && svelte-check --tsconfig ./tsconfig.json | meechies-coloringbook@0.1.0 test | vitest run --pool=forks --maxWorkers=1 | echo "exit=$?"
- verify.txt (1354 bytes)
  Commands: node scripts/verify-runner.mjs | npm run check | meechies-coloringbook@0.1.0 check | svelte-kit sync && svelte-check --tsconfig ./tsconfig.json | npm test -- --pool=forks --maxWorkers=1 | meechies-coloringbook@0.1.0 test | vitest run --pool=forks --maxWorkers=1

Older than this run's chamber-lock.json: cipher-gate.json, evidence-gate-selection-red-proof.txt.
These files were written by an earlier run, so they describe a different run than
the one this tape summarizes. Regenerate them or read them as history, not as proof
of the current change.
