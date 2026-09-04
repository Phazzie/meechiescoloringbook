<!--
Purpose: Summarize evidence artifacts in plain language.
Why: Help non-coders understand proof coverage without reading code.
Info flow: evidence files -> summary -> review.
-->
# Proof Tape

Generated at: 2026-09-04T15:03:22.051Z
Evidence folder: docs/evidence/2026-09-04

Files included (this tape's own outputs, proof-tape.json and proof-tape.md, are written
after this inventory is taken, so they are not listed):

- assumption-alarm.json (12123 bytes)
- build.txt (1471 bytes)
  Commands: Using @sveltejs/adapter-vercel
- chamber-lock.json (28496 bytes)
- cipher-gate.json (3509 bytes) — PREDATES THIS VERIFY RUN
- clan-chain.json (2532 bytes)
- clan-chain.md (1559 bytes)
- e2e.txt (3015 bytes)
- lint.txt (182 bytes)
  Commands: meechies-coloringbook@0.1.0 lint | eslint .
- seam-ledger.json (30250 bytes)
- seam-ledger.md (2409 bytes)
- shaolin-lint.json (517 bytes)
- test.txt (1031 bytes)
  Commands: meechies-coloringbook@0.1.0 test | vitest run --pool=forks --maxWorkers=1
- verify-chain.txt (22991 bytes)
- verify.txt (1356 bytes)
  Commands: meechies-coloringbook@0.1.0 check | svelte-kit sync && svelte-check --tsconfig ./tsconfig.json | meechies-coloringbook@0.1.0 test | vitest run --pool=forks --maxWorkers=1

Older than this run's chamber-lock.json: cipher-gate.json.
These files were written by an earlier run, so they describe a different run than
the one this tape summarizes. Regenerate them or read them as history, not as proof
of the current change.
