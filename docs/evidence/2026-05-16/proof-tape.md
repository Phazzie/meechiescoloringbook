<!--
Purpose: Summarize evidence artifacts in plain language.
Why: Help non-coders understand proof coverage without reading code.
Info flow: evidence files -> summary -> review.
-->
# Proof Tape

Generated at: 2026-05-16T09:19:30.481Z
Evidence folder: docs\evidence\2026-05-16

Files included:
- assumption-alarm.json (2961 bytes)
- chamber-lock.json (18962 bytes)
- cipher-gate.json (1103 bytes)
- clan-chain.json (1735 bytes)
- clan-chain.md (1121 bytes)
- proof-tape.json (2253 bytes)
- proof-tape.md (841 bytes)
- seam-ledger.json (20157 bytes)
- seam-ledger.md (1721 bytes)
- shaolin-lint.json (518 bytes)
- test.txt (7424 bytes)
  Commands: meechies-coloringbook@0.1.0 test | vitest run --pool=forks --maxWorkers=1
- verify.txt (7693 bytes)
  Commands: meechies-coloringbook@0.1.0 check | svelte-kit sync && svelte-check --tsconfig ./tsconfig.json | meechies-coloringbook@0.1.0 test | vitest run --pool=forks --maxWorkers=1

