<!--
Purpose: Summarize evidence artifacts in plain language.
Why: Help non-coders understand proof coverage without reading code.
Info flow: evidence files -> summary -> review.
-->
# Proof Tape

Generated at: 2026-08-25T00:43:19.231Z
Evidence folder: docs/evidence/2026-08-25

Files included:
- assumption-alarm.json (3636 bytes)
- chamber-lock.json (24795 bytes)
- cipher-gate.json (1231 bytes)
- clan-chain.json (2247 bytes)
- clan-chain.md (1418 bytes)
- proof-tape.json (3040 bytes)
- proof-tape.md (975 bytes)
- rewind-PromptAssemblySeam.txt (376 bytes)
- seam-ledger.json (26323 bytes)
- seam-ledger.md (2168 bytes)
- shaolin-lint.json (519 bytes)
- test.txt (1136 bytes)
  Commands: meechies-coloringbook@0.1.0 test | vitest run --pool=forks --maxWorkers=1
- verify.txt (1702 bytes)
  Commands: meechies-coloringbook@0.1.0 check | svelte-kit sync && svelte-check --tsconfig ./tsconfig.json | meechies-coloringbook@0.1.0 test | vitest run --pool=forks --maxWorkers=1
