<!--
Purpose: Summarize evidence artifacts in plain language.
Why: Help non-coders understand proof coverage without reading code.
Info flow: evidence files -> summary -> review.
-->
# Proof Tape

Generated at: 2026-05-18T12:53:26.619Z
Evidence folder: docs/evidence/2026-05-18

Files included:
- assumption-alarm.json (3636 bytes)
- chamber-lock.json (20456 bytes)
- clan-chain.json (1787 bytes)
- clan-chain.md (1139 bytes)
- proof-tape.json (2224 bytes)
- proof-tape.md (841 bytes)
- seam-ledger.json (21714 bytes)
- seam-ledger.md (1764 bytes)
- shaolin-lint.json (519 bytes)
- test.txt (4111 bytes)
  Commands: meechies-coloringbook@0.1.0 test | vitest run --pool=forks --maxWorkers=1
- verify.txt (4370 bytes)
  Commands: meechies-coloringbook@0.1.0 check | svelte-kit sync && svelte-check --tsconfig ./tsconfig.json | meechies-coloringbook@0.1.0 test | vitest run --pool=forks --maxWorkers=1

