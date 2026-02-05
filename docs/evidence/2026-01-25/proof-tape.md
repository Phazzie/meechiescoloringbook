<!--
Purpose: Summarize evidence artifacts in plain language.
Why: Help non-coders understand proof coverage without reading code.
Info flow: evidence files -> summary -> review.
-->
# Proof Tape

Generated at: 2026-01-25T03:45:51.118Z
Evidence folder: docs/evidence/2026-01-25

Files included:
- assumption-alarm.json (1639 bytes)
- chamber-lock.json (9710 bytes)
- cipher-gate.json (1132 bytes)
- clan-chain.json (1250 bytes)
- clan-chain.md (888 bytes)
- probe-chat-interpretation.txt (47 bytes)
- probe-image-generation.txt (44 bytes)
- probe-provider-adapter.txt (36 bytes)
- proof-tape.json (3865 bytes)
- proof-tape.md (1355 bytes)
- seam-ledger.json (10316 bytes)
- seam-ledger.md (1054 bytes)
- shaolin-lint.json (577 bytes)
- test.txt (1090 bytes)
  Commands: coloringbook-svelte@0.0.1 test | vitest run
- verify.txt (1902 bytes)
  Commands: coloringbook-svelte@0.0.1 check | svelte-kit sync && svelte-check --tsconfig ./tsconfig.json | coloringbook-svelte@0.0.1 test | vitest run | coloringbook-svelte@0.0.1 shaolin:lint | node scripts/shaolin-lint.mjs | coloringbook-svelte@0.0.1 assumption:alarm | node scripts/assumption-alarm.mjs | coloringbook-svelte@0.0.1 seam:ledger | node scripts/seam-ledger.mjs | coloringbook-svelte@0.0.1 clan:chain | node scripts/clan-chain.mjs | coloringbook-svelte@0.0.1 proof:tape | node scripts/proof-tape.mjs

