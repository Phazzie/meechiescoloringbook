<!--
Purpose: Summarize evidence artifacts in plain language.
Why: Help non-coders understand proof coverage without reading code.
Info flow: evidence files -> summary -> review.
-->
# Proof Tape

Generated at: 2026-05-20T21:28:17.572Z
Evidence folder: docs/evidence/2026-05-20

Files included:
- assumption-alarm.json (3636 bytes)
- chamber-lock.json (20456 bytes)
- clan-chain.json (1787 bytes)
- clan-chain.md (1139 bytes)
- seam-ledger.json (21714 bytes)
- seam-ledger.md (1764 bytes)
- shaolin-lint.json (518 bytes)
- test.txt (4112 bytes)
  Commands: meechies-coloringbook@0.1.0 test | vitest run --pool=forks --maxWorkers=1
- verify.txt (4371 bytes)
  Commands: meechies-coloringbook@0.1.0 check | svelte-kit sync && svelte-check --tsconfig ./tsconfig.json | meechies-coloringbook@0.1.0 test | vitest run --pool=forks --maxWorkers=1

