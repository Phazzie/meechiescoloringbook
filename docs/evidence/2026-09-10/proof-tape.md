<!--
Purpose: Summarize evidence artifacts in plain language.
Why: Help non-coders understand proof coverage without reading code.
Info flow: evidence files -> summary -> review.
-->
# Proof Tape

Generated at: 2026-09-10T03:57:24.971Z
Evidence folder: docs/evidence/2026-09-10

Files included (this tape's own outputs, proof-tape.json and proof-tape.md, are written
after this inventory is taken, so they are not listed):

- assumption-alarm.json (13941 bytes)
- chamber-lock.json (35315 bytes)
- clan-chain.json (3181 bytes)
- clan-chain.md (1956 bytes)
- seam-ledger.json (37511 bytes)
- seam-ledger.md (2981 bytes)
- shaolin-lint.json (517 bytes)
- test.txt (3333 bytes)
  Commands: meechies-coloringbook@0.1.0 test | vitest run --pool=forks --maxWorkers=1
- verify.txt (3658 bytes)
  Commands: meechies-coloringbook@0.1.0 check | svelte-kit sync && svelte-check --tsconfig ./tsconfig.json | meechies-coloringbook@0.1.0 test | vitest run --pool=forks --maxWorkers=1
