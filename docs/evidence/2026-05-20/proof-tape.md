<!--
Purpose: Summarize evidence artifacts in plain language.
Why: Help non-coders understand proof coverage without reading code.
Info flow: evidence files -> summary -> review.
-->
# Proof Tape

Generated at: 2026-05-20T12:31:18.076Z
Evidence folder: docs/evidence/2026-05-20

Files included:
- assumption-alarm.json (3636 bytes)
- chamber-lock.json (19945 bytes)
- cipher-gate.json (777 bytes)
- clan-chain.json (1787 bytes)
- clan-chain.md (1139 bytes)
- proof-tape.json (2615 bytes)
- proof-tape.md (900 bytes)
- rewind-ImageGenerationSeam.txt (473 bytes)
- seam-ledger.json (21225 bytes)
- seam-ledger.md (1764 bytes)
- shaolin-lint.json (519 bytes)
- test.txt (4059 bytes)
  Commands: meechies-coloringbook@0.1.0 test | vitest run --pool=forks --maxWorkers=1
- verify.txt (4318 bytes)
  Commands: meechies-coloringbook@0.1.0 check | svelte-kit sync && svelte-check --tsconfig ./tsconfig.json | meechies-coloringbook@0.1.0 test | vitest run --pool=forks --maxWorkers=1

