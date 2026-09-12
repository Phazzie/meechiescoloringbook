<!--
Purpose: Summarize evidence artifacts in plain language.
Why: Help non-coders understand proof coverage without reading code.
Info flow: evidence files -> summary -> review.
-->
# Proof Tape

Generated at: 2026-09-12T00:51:23.697Z
Evidence folder: docs/evidence/2026-09-12

Files included (this tape's own outputs, proof-tape.json and proof-tape.md, are written
after this inventory is taken, so they are not listed; nor is
verify-outer.txt, which the wrapper around this chain is still
writing while this runs and would therefore always be listed short):

- abortproof-triage-table.txt (2258 bytes) — PREDATES THIS VERIFY RUN
- assumption-alarm.json (18402 bytes)
- build.txt (15838 bytes) — PREDATES THIS VERIFY RUN
  Commands: meechies-coloringbook@0.1.0 build | vite build | Using @sveltejs/adapter-vercel
- chamber-lock.json (35315 bytes)
- check.txt (240 bytes) — PREDATES THIS VERIFY RUN
  Commands: meechies-coloringbook@0.1.0 check | svelte-kit sync && svelte-check --tsconfig ./tsconfig.json
- cipher-gate-run.txt (75 bytes) — PREDATES THIS VERIFY RUN
  Commands: meechies-coloringbook@0.1.0 cipher:gate | node scripts/cipher-gate.mjs
- cipher-gate.json (3151 bytes) — PREDATES THIS VERIFY RUN
- clan-chain.json (3181 bytes)
- clan-chain.md (1956 bytes)
- lint.txt (48 bytes) — PREDATES THIS VERIFY RUN
  Commands: meechies-coloringbook@0.1.0 lint | eslint .
- redproof-safety-keyword-parity.txt (1936 bytes) — PREDATES THIS VERIFY RUN
- redproof-triage-lossless-paths.txt (5630 bytes) — PREDATES THIS VERIFY RUN
- rewind-SafetyPolicySeam.txt (399 bytes) — PREDATES THIS VERIFY RUN
- seam-ledger.json (37511 bytes)
- seam-ledger.md (2981 bytes)
- shaolin-lint.json (519 bytes)
- sonarjs-local.txt (19540 bytes) — PREDATES THIS VERIFY RUN
- test.txt (3134 bytes)
  Commands: meechies-coloringbook@0.1.0 test | vitest run --pool=forks --maxWorkers=1
- verify.txt (3459 bytes)
  Commands: meechies-coloringbook@0.1.0 check | svelte-kit sync && svelte-check --tsconfig ./tsconfig.json | meechies-coloringbook@0.1.0 test | vitest run --pool=forks --maxWorkers=1

Older than this run's chamber-lock.json: abortproof-triage-table.txt, build.txt, check.txt, cipher-gate-run.txt, cipher-gate.json, lint.txt, redproof-safety-keyword-parity.txt, redproof-triage-lossless-paths.txt, rewind-SafetyPolicySeam.txt, sonarjs-local.txt.
These files were written by an earlier run, so they describe a different run than
the one this tape summarizes. Regenerate them or read them as history, not as proof
of the current change.
