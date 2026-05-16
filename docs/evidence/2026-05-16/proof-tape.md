<!--
Purpose: Summarize evidence artifacts in plain language.
Why: Help non-coders understand proof coverage without reading code.
Info flow: evidence files -> summary -> review.
-->
# Proof Tape

Generated at: 2026-05-16T16:15:41.368Z
Evidence folder: docs\evidence\2026-05-16

Files included:
- assumption-alarm.json (3636 bytes)
- chamber-lock.json (20854 bytes)
- cipher-gate.json (1257 bytes)
- clan-chain.json (1883 bytes)
- clan-chain.md (1197 bytes)
- proof-tape.json (3885 bytes)
- proof-tape.md (1135 bytes)
- rewind-CacheSeam.txt (708 bytes)
- rewind-ChatInterpretationSeam.txt (715 bytes)
- rewind-DriftDetectionSeam.txt (711 bytes)
- rewind-ImageGenerationSeam.txt (712 bytes)
- seam-ledger.json (22173 bytes)
- seam-ledger.md (1847 bytes)
- shaolin-lint.json (519 bytes)
- test.txt (7289 bytes)
  Commands: meechies-coloringbook@0.1.0 test | vitest run --pool=forks --maxWorkers=1
- verify.txt (7558 bytes)
  Commands: meechies-coloringbook@0.1.0 check | svelte-kit sync && svelte-check --tsconfig ./tsconfig.json | meechies-coloringbook@0.1.0 test | vitest run --pool=forks --maxWorkers=1

