<!--
Purpose: Summarize evidence artifacts in plain language.
Why: Help non-coders understand proof coverage without reading code.
Info flow: evidence files -> summary -> review.
-->
# Proof Tape

Generated at: 2026-06-24T10:59:18.624Z
Evidence folder: docs/evidence/2026-06-24

Files included:
- assumption-alarm.json (3636 bytes)
- chamber-lock.json (25751 bytes)
- cipher-gate.json (1760 bytes)
- clan-chain.json (2315 bytes)
- clan-chain.md (1450 bytes)
- proof-tape.json (2815 bytes)
- proof-tape.md (931 bytes)
- seam-ledger.json (27330 bytes)
- seam-ledger.md (2228 bytes)
- shaolin-lint.json (516 bytes)
- test.txt (1010 bytes)
  Commands: meechies-coloringbook@0.1.0 test | vitest run --pool=forks --maxWorkers=1
- verify.txt (1269 bytes)
  Commands: meechies-coloringbook@0.1.0 check | svelte-kit sync && svelte-check --tsconfig ./tsconfig.json | meechies-coloringbook@0.1.0 test | vitest run --pool=forks --maxWorkers=1
