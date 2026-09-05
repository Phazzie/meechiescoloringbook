<!--
Purpose: Summarize evidence artifacts in plain language.
Why: Help non-coders understand proof coverage without reading code.
Info flow: evidence files -> summary -> review.
-->
# Proof Tape

Generated at: 2026-09-05T05:17:15.280Z
Evidence folder: docs\evidence\2026-09-05

Files included (this tape's own outputs, proof-tape.json and proof-tape.md, are written
after this inventory is taken, so they are not listed):

- assumption-alarm.json (9484 bytes)
- chamber-lock.json (28568 bytes)
- cipher-gate.json (1096 bytes) — PREDATES THIS VERIFY RUN
- clan-chain.json (2588 bytes)
- clan-chain.md (1613 bytes)
- rewind-AuthContextSeam(self-contained).txt (658 bytes) — PREDATES THIS VERIFY RUN
- rewind-AuthContextSeam.txt (654 bytes) — PREDATES THIS VERIFY RUN
- rewind-CreationStoreSeam(self-contained).txt (660 bytes) — PREDATES THIS VERIFY RUN
- rewind-CreationStoreSeam.txt (658 bytes) — PREDATES THIS VERIFY RUN
- rewind-SessionSeam(self-contained).txt (652 bytes) — PREDATES THIS VERIFY RUN
- rewind-SessionSeam.txt (648 bytes) — PREDATES THIS VERIFY RUN
- seam-ledger.json (30322 bytes)
- seam-ledger.md (2463 bytes)
- shaolin-lint.json (519 bytes)
- test.txt (12665 bytes)
  Commands: meechies-coloringbook@0.1.0 test | vitest run --pool=forks --maxWorkers=1
- verify.txt (13000 bytes)
  Commands: meechies-coloringbook@0.1.0 check | svelte-kit sync && svelte-check --tsconfig ./tsconfig.json | meechies-coloringbook@0.1.0 test | vitest run --pool=forks --maxWorkers=1

Older than this run's chamber-lock.json: cipher-gate.json, rewind-AuthContextSeam(self-contained).txt, rewind-AuthContextSeam.txt, rewind-CreationStoreSeam(self-contained).txt, rewind-CreationStoreSeam.txt, rewind-SessionSeam(self-contained).txt, rewind-SessionSeam.txt.
These files were written by an earlier run, so they describe a different run than
the one this tape summarizes. Regenerate them or read them as history, not as proof
of the current change.
