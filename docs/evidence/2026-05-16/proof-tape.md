<!--
Purpose: Summarize evidence artifacts in plain language.
Why: Help non-coders understand proof coverage without reading code.
Info flow: evidence files -> summary -> review.
-->
# Proof Tape

Generated at: 2026-05-16T13:48:06.851Z
Evidence folder: docs\evidence\2026-05-16

Files included:
- assumption-alarm.json (3636 bytes)
- chamber-lock.json (19963 bytes)
- cipher-gate.json (993 bytes)
- clan-chain.json (1816 bytes)
- clan-chain.md (1166 bytes)
- proof-tape.json (3429 bytes)
- proof-tape.md (1051 bytes)
- rewind-ChatInterpretationSeam.txt (715 bytes)
- rewind-DriftDetectionSeam.txt (711 bytes)
- rewind-ImageGenerationSeam.txt (698 bytes)
- seam-ledger.json (21212 bytes)
- seam-ledger.md (1791 bytes)
- shaolin-lint.json (519 bytes)
- test.txt (7550 bytes)
  Commands: meechies-coloringbook@0.1.0 test | vitest run --pool=forks --maxWorkers=1
- verify.txt (7819 bytes)
  Commands: meechies-coloringbook@0.1.0 check | svelte-kit sync && svelte-check --tsconfig ./tsconfig.json | meechies-coloringbook@0.1.0 test | vitest run --pool=forks --maxWorkers=1

