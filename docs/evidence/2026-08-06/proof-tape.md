<!--
Purpose: Summarize evidence artifacts in plain language.
Why: Help non-coders understand proof coverage without reading code.
Info flow: evidence files -> summary -> review.
-->
# Proof Tape

Generated at: 2026-08-06T07:21:18.401Z
Evidence folder: docs\evidence\2026-08-06

Files included:
- assumption-alarm.json (4426 bytes)
- chamber-lock.json (24795 bytes)
- clan-chain.json (2249 bytes)
- clan-chain.md (1418 bytes)
- proof-tape.json (2253 bytes)
- proof-tape.md (840 bytes)
- seam-ledger.json (26323 bytes)
- seam-ledger.md (2168 bytes)
- shaolin-lint.json (517 bytes)
- test.txt (1066 bytes)
  Commands: meechies-coloringbook@0.1.0 test | vitest run --pool=forks --maxWorkers=1
- verify.txt (1335 bytes)
  Commands: meechies-coloringbook@0.1.0 check | svelte-kit sync && svelte-check --tsconfig ./tsconfig.json | meechies-coloringbook@0.1.0 test | vitest run --pool=forks --maxWorkers=1
