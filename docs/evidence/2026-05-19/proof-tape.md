<!--
Purpose: Summarize evidence artifacts in plain language.
Why: Help non-coders understand proof coverage without reading code.
Info flow: evidence files -> summary -> review.
-->
# Proof Tape

Generated at: 2026-05-19T12:11:50.441Z
Evidence folder: docs/evidence/2026-05-19

Files included:
- assumption-alarm.json (3636 bytes)
- chamber-lock.json (20854 bytes)
- clan-chain.json (1881 bytes)
- clan-chain.md (1197 bytes)
- proof-tape.json (2224 bytes)
- proof-tape.md (841 bytes)
- seam-ledger.json (22173 bytes)
- seam-ledger.md (1847 bytes)
- shaolin-lint.json (518 bytes)
- test.txt (4065 bytes)
  Commands: meechies-coloringbook@0.1.0 test | vitest run --pool=forks --maxWorkers=1
- verify.txt (4324 bytes)
  Commands: meechies-coloringbook@0.1.0 check | svelte-kit sync && svelte-check --tsconfig ./tsconfig.json | meechies-coloringbook@0.1.0 test | vitest run --pool=forks --maxWorkers=1

