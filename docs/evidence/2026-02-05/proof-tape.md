<!--
Purpose: Summarize evidence artifacts in plain language.
Why: Help non-coders understand proof coverage without reading code.
Info flow: evidence files -> summary -> review.
-->
# Proof Tape

Generated at: 2026-02-05T05:36:43.474Z
Evidence folder: docs/evidence/2026-02-05

Files included:
- assumption-alarm.json (1575 bytes)
- chamber-lock.json (9765 bytes)
- cipher-gate.json (1137 bytes)
- clan-chain.json (1090 bytes)
- clan-chain.md (786 bytes)
- npm-test.txt (915 bytes)
  Commands: coloringbook-svelte@0.0.1 test | vitest run
- npm-verify.txt (1903 bytes)
  Commands: coloringbook-svelte@0.0.1 verify | npm run chamber:lock && npm run verify:runner && npm run shaolin:lint && npm run assumption:alarm && npm run seam:ledger && npm run clan:chain && npm run proof:tape && npm run cipher:gate | coloringbook-svelte@0.0.1 chamber:lock | node scripts/chamber-lock.mjs | coloringbook-svelte@0.0.1 verify:runner | node scripts/verify-runner.mjs | coloringbook-svelte@0.0.1 check | svelte-kit sync && svelte-check --tsconfig ./tsconfig.json | coloringbook-svelte@0.0.1 test | vitest run | coloringbook-svelte@0.0.1 shaolin:lint | node scripts/shaolin-lint.mjs | coloringbook-svelte@0.0.1 assumption:alarm | node scripts/assumption-alarm.mjs | coloringbook-svelte@0.0.1 seam:ledger | node scripts/seam-ledger.mjs | coloringbook-svelte@0.0.1 clan:chain | node scripts/clan-chain.mjs | coloringbook-svelte@0.0.1 proof:tape | node scripts/proof-tape.mjs
- probe-browser-seams.txt (92 bytes)
- proof-tape.json (2160 bytes)
- proof-tape.md (777 bytes)
- rewind-AuthContextSeam.txt (463 bytes)
- rewind-CreationStoreSeam.txt (464 bytes)
- rewind-SessionSeam.txt (457 bytes)
- rewind-auth-context-seam.txt (368 bytes)
  Commands: coloringbook-svelte@0.0.1 rewind | node scripts/rewind.mjs --seam AuthContextSeam
- rewind-creation-store-seam.txt (371 bytes)
  Commands: coloringbook-svelte@0.0.1 rewind | node scripts/rewind.mjs --seam CreationStoreSeam
- rewind-session-seam.txt (358 bytes)
  Commands: coloringbook-svelte@0.0.1 rewind | node scripts/rewind.mjs --seam SessionSeam
- seam-ledger.json (10412 bytes)
- seam-ledger.md (1054 bytes)
- shaolin-lint.json (579 bytes)
- test.txt (1091 bytes)
  Commands: coloringbook-svelte@0.0.1 test | vitest run
- verify.txt (1332 bytes)
  Commands: coloringbook-svelte@0.0.1 check | svelte-kit sync && svelte-check --tsconfig ./tsconfig.json | coloringbook-svelte@0.0.1 test | vitest run

