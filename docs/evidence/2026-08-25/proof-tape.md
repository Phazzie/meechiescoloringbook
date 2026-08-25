<!--
Purpose: Summarize evidence artifacts in plain language.
Why: Help non-coders understand proof coverage without reading code.
Info flow: evidence files -> summary -> review.
-->
# Proof Tape

Generated at: 2026-08-25T01:02:36.675Z
Evidence folder: docs/evidence/2026-08-25

Files included:
- assumption-alarm.json (3636 bytes)
- chamber-lock.json (24795 bytes)
- cipher-gate.json (1477 bytes)
- clan-chain.json (2247 bytes)
- clan-chain.md (1418 bytes)
- proof-tape.json (3583 bytes)
- proof-tape.md (1303 bytes)
- rewind-PromptAssemblySeam(self-contained).txt (376 bytes)
- rewind-PromptAssemblySeam.txt (374 bytes)
- seam-ledger.json (26323 bytes)
- seam-ledger.md (2168 bytes)
- shaolin-lint.json (518 bytes)
- test.txt (1136 bytes)
  Commands: meechies-coloringbook@0.1.0 test | vitest run --pool=forks --maxWorkers=1
- verify.txt (2274 bytes)
  Commands: meechies-coloringbook@0.1.0 verify | node scripts/chamber-lock.mjs && node scripts/verify-runner.mjs && node scripts/shaolin-lint.mjs && node scripts/assumption-alarm.mjs && node scripts/seam-ledger.mjs && node scripts/clan-chain.mjs && node scripts/proof-tape.mjs | meechies-coloringbook@0.1.0 check | svelte-kit sync && svelte-check --tsconfig ./tsconfig.json | meechies-coloringbook@0.1.0 test | vitest run --pool=forks --maxWorkers=1
