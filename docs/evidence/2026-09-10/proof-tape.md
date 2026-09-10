<!--
Purpose: Summarize evidence artifacts in plain language.
Why: Help non-coders understand proof coverage without reading code.
Info flow: evidence files -> summary -> review.
-->
# Proof Tape

Generated at: 2026-09-10T13:23:30.202Z
Evidence folder: docs/evidence/2026-09-10

Files included (this tape's own outputs, proof-tape.json and proof-tape.md, are written
after this inventory is taken, so they are not listed; nor is
verify-outer.txt, which the wrapper around this chain is still
writing while this runs and would therefore always be listed short):

- assumption-alarm.json (13941 bytes)
- build.txt (15838 bytes) — PREDATES THIS VERIFY RUN
  Commands: meechies-coloringbook@0.1.0 build | vite build | Using @sveltejs/adapter-vercel
- chamber-lock.json (35315 bytes)
- check.txt (240 bytes) — PREDATES THIS VERIFY RUN
  Commands: meechies-coloringbook@0.1.0 check | svelte-kit sync && svelte-check --tsconfig ./tsconfig.json
- cipher-gate.json (2458 bytes) — PREDATES THIS VERIFY RUN
- clan-chain.json (3181 bytes)
- clan-chain.md (1956 bytes)
- e2e.txt (11436 bytes) — PREDATES THIS VERIFY RUN
  Commands: meechies-coloringbook@0.1.0 test:e2e:local | playwright test --config=playwright.local.config.ts
- lint.txt (48 bytes) — PREDATES THIS VERIFY RUN
  Commands: meechies-coloringbook@0.1.0 lint | eslint .
- seam-ledger.json (37511 bytes)
- seam-ledger.md (2981 bytes)
- shaolin-lint.json (519 bytes)
- test.txt (3333 bytes)
  Commands: meechies-coloringbook@0.1.0 test | vitest run --pool=forks --maxWorkers=1
- verify.txt (3658 bytes)
  Commands: meechies-coloringbook@0.1.0 check | svelte-kit sync && svelte-check --tsconfig ./tsconfig.json | meechies-coloringbook@0.1.0 test | vitest run --pool=forks --maxWorkers=1

Older than this run's chamber-lock.json: build.txt, check.txt, cipher-gate.json, e2e.txt, lint.txt.
These files were written by an earlier run, so they describe a different run than
the one this tape summarizes. Regenerate them or read them as history, not as proof
of the current change.
