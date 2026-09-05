<!--
Purpose: Summarize evidence artifacts in plain language.
Why: Help non-coders understand proof coverage without reading code.
Info flow: evidence files -> summary -> review.
-->
# Proof Tape

Generated at: 2026-09-05T02:02:01.402Z
Evidence folder: docs/evidence/2026-09-05

Files included (this tape's own outputs, proof-tape.json and proof-tape.md, are written
after this inventory is taken, so they are not listed):

- assumption-alarm.json (12123 bytes)
- build.txt (11439 bytes) — PREDATES THIS VERIFY RUN
  Commands: meechies-coloringbook@0.1.0 build | vite build | Using @sveltejs/adapter-vercel
- chamber-lock.json (28496 bytes)
- cipher-gate.json (4357 bytes) — PREDATES THIS VERIFY RUN
- clan-chain.json (2532 bytes)
- clan-chain.md (1559 bytes)
- e2e.txt (4852 bytes) — PREDATES THIS VERIFY RUN
- lint.txt (341 bytes) — PREDATES THIS VERIFY RUN
  Commands: meechies-coloringbook@0.1.0 lint | eslint .
- rewind-WigCatalogSeam.txt (540 bytes) — PREDATES THIS VERIFY RUN
- rewind-wig-catalog-seam.txt (782 bytes) — PREDATES THIS VERIFY RUN
  Commands: meechies-coloringbook@0.1.0 rewind | node scripts/rewind.mjs --seam WigCatalogSeam
- seam-ledger.json (30250 bytes)
- seam-ledger.md (2409 bytes)
- shaolin-lint.json (517 bytes)
- test.txt (1031 bytes)
  Commands: meechies-coloringbook@0.1.0 test | vitest run --pool=forks --maxWorkers=1
- verify-chain.txt (4632 bytes) — PREDATES THIS VERIFY RUN
- verify.txt (1356 bytes)
  Commands: meechies-coloringbook@0.1.0 check | svelte-kit sync && svelte-check --tsconfig ./tsconfig.json | meechies-coloringbook@0.1.0 test | vitest run --pool=forks --maxWorkers=1

Older than this run's chamber-lock.json: build.txt, cipher-gate.json, e2e.txt, lint.txt, rewind-WigCatalogSeam.txt, rewind-wig-catalog-seam.txt, verify-chain.txt.
These files were written by an earlier run, so they describe a different run than
the one this tape summarizes. Regenerate them or read them as history, not as proof
of the current change.
