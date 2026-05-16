<!--
Purpose: Summarize evidence artifacts in plain language.
Why: Help non-coders understand proof coverage without reading code.
Info flow: evidence files -> summary -> review.
-->
# Proof Tape

Generated at: 2026-05-16T13:31:41.187Z
Evidence folder: docs\evidence\2026-05-16

Files included:
- assumption-alarm.json (2961 bytes)
- chamber-lock.json (18962 bytes)
- cipher-gate.json (959 bytes)
- clan-chain.json (1735 bytes)
- clan-chain.md (1121 bytes)
- proof-tape.json (2853 bytes)
- proof-tape.md (932 bytes)
- rewind-ChatInterpretationSeam.txt (715 bytes)
- rewind-DriftDetectionSeam.txt (697 bytes)
- seam-ledger.json (20157 bytes)
- seam-ledger.md (1721 bytes)
- shaolin-lint.json (519 bytes)
- test.txt (7425 bytes)
  Commands: meechies-coloringbook@0.1.0 test | vitest run --pool=forks --maxWorkers=1
- verify.txt (7694 bytes)
  Commands: meechies-coloringbook@0.1.0 check | svelte-kit sync && svelte-check --tsconfig ./tsconfig.json | meechies-coloringbook@0.1.0 test | vitest run --pool=forks --maxWorkers=1

