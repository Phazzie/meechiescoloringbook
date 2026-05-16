<!--
Purpose: Summarize evidence artifacts in plain language.
Why: Help non-coders understand proof coverage without reading code.
Info flow: evidence files -> summary -> review.
-->
# Proof Tape

Generated at: 2026-05-14T22:47:14.528Z
Evidence folder: docs/evidence/2026-05-14

Files included:
- assumption-alarm.json (2961 bytes)
- chamber-lock.json (18962 bytes)
- cipher-gate.json (1252 bytes)
- clan-chain.json (1733 bytes)
- clan-chain.md (1121 bytes)
- proof-tape.json (2451 bytes)
- proof-tape.md (886 bytes)
- rewind-ImageGenerationSeam.txt (474 bytes)
- seam-ledger.json (20157 bytes)
- seam-ledger.md (1721 bytes)
- shaolin-lint.json (517 bytes)
- test.txt (4309 bytes)
  Commands: meechies-coloringbook@0.1.0 test | vitest run --pool=forks --maxWorkers=1
- verify.txt (4667 bytes)
  Commands: meechies-coloringbook@0.1.0 check | svelte-kit sync && svelte-check --tsconfig ./tsconfig.json | meechies-coloringbook@0.1.0 test | vitest run --pool=forks --maxWorkers=1

