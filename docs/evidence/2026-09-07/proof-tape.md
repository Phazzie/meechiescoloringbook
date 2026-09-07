<!--
Purpose: Summarize evidence artifacts in plain language.
Why: Help non-coders understand proof coverage without reading code.
Info flow: evidence files -> summary -> review.
-->
# Proof Tape

Generated at: 2026-09-07T13:11:32.021Z
Evidence folder: docs/evidence/2026-09-07

Files included (this tape's own outputs, proof-tape.json and proof-tape.md, are written
after this inventory is taken, so they are not listed):

- assumption-alarm.json (13941 bytes)
- build.txt (12814 bytes) — PREDATES THIS VERIFY RUN
  Commands: meechies-coloringbook@0.1.0 build | vite build | Using @sveltejs/adapter-vercel
- chamber-lock.json (35315 bytes)
- clan-chain.json (3181 bytes)
- clan-chain.md (1956 bytes)
- e2e-print.txt (1153 bytes) — PREDATES THIS VERIFY RUN
- e2e-run14.txt (8319 bytes) — PREDATES THIS VERIFY RUN
- e2e.txt (7601 bytes) — PREDATES THIS VERIFY RUN
- export-row-after.txt (1678 bytes) — PREDATES THIS VERIFY RUN
- export-row-before.txt (1448 bytes) — PREDATES THIS VERIFY RUN
- lint.txt (48 bytes) — PREDATES THIS VERIFY RUN
  Commands: meechies-coloringbook@0.1.0 lint | eslint .
- redproof-share-policy.txt (3007 bytes) — PREDATES THIS VERIFY RUN
  Commands: 243 | 	expect(calls[0].files[0].type).toBe('image/png');
- redproof-title-restore.txt (1553 bytes) — PREDATES THIS VERIFY RUN
  Commands: 288 | 	await expect.poll(() => page.title()).toBe(appTitle);
- run14-check-lint-test-build.txt (432 bytes) — PREDATES THIS VERIFY RUN
  Commands: Using @sveltejs/adapter-vercel
- seam-ledger.json (37511 bytes)
- seam-ledger.md (2981 bytes)
- shaolin-lint.json (519 bytes)
- sonarjs-local-run14.txt (3208 bytes) — PREDATES THIS VERIFY RUN
- sonarjs-local.txt (2365 bytes) — PREDATES THIS VERIFY RUN
- test.txt (3233 bytes)
  Commands: meechies-coloringbook@0.1.0 test | vitest run --pool=forks --maxWorkers=1
- verify-run14.txt (1012 bytes) — PREDATES THIS VERIFY RUN
  Commands: meechies-coloringbook@0.1.0 verify | npm run audit:gate && node scripts/chamber-lock.mjs && node scripts/verify-runner.mjs && node scripts/shaolin-lint.mjs && node scripts/assumption-alarm.mjs && node scripts/seam-ledger.mjs && node scripts/clan-chain.mjs && node scripts/proof-tape.mjs | meechies-coloringbook@0.1.0 audit:gate | npm audit --audit-level=high | meechies-coloringbook@0.1.0 check | svelte-kit sync && svelte-check --tsconfig ./tsconfig.json | meechies-coloringbook@0.1.0 test | vitest run --pool=forks --maxWorkers=1
- verify.txt (3558 bytes)
  Commands: meechies-coloringbook@0.1.0 check | svelte-kit sync && svelte-check --tsconfig ./tsconfig.json | meechies-coloringbook@0.1.0 test | vitest run --pool=forks --maxWorkers=1

Older than this run's chamber-lock.json: build.txt, e2e-print.txt, e2e-run14.txt, e2e.txt, export-row-after.txt, export-row-before.txt, lint.txt, redproof-share-policy.txt, redproof-title-restore.txt, run14-check-lint-test-build.txt, sonarjs-local-run14.txt, sonarjs-local.txt, verify-run14.txt.
These files were written by an earlier run, so they describe a different run than
the one this tape summarizes. Regenerate them or read them as history, not as proof
of the current change.
