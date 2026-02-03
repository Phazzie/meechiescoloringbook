<!--
Purpose: Summarize evidence artifacts in plain language.
Why: Help non-coders understand proof coverage without reading code.
Info flow: evidence files -> summary -> review.
-->
# Proof Tape

Generated at: 2026-02-01T23:11:06.027Z
Evidence folder: docs/evidence/2026-02-01

Files included:
- assumption-alarm.json (1555 bytes)
- chamber-lock.json (9743 bytes)
- cipher-gate.json (1011 bytes)
- clan-chain.json (1171 bytes)
- clan-chain.md (837 bytes)
- npm-build.txt (5673 bytes)
  Commands: coloringbook-svelte@0.0.1 build | vite build | Using @sveltejs/adapter-auto
- npm-test.txt (914 bytes)
  Commands: coloringbook-svelte@0.0.1 test | vitest run
- npm-verify.txt (1904 bytes)
  Commands: coloringbook-svelte@0.0.1 verify | npm run chamber:lock && npm run verify:runner && npm run shaolin:lint && npm run assumption:alarm && npm run seam:ledger && npm run clan:chain && npm run proof:tape && npm run cipher:gate | coloringbook-svelte@0.0.1 chamber:lock | node scripts/chamber-lock.mjs | coloringbook-svelte@0.0.1 verify:runner | node scripts/verify-runner.mjs | coloringbook-svelte@0.0.1 check | svelte-kit sync && svelte-check --tsconfig ./tsconfig.json | coloringbook-svelte@0.0.1 test | vitest run | coloringbook-svelte@0.0.1 shaolin:lint | node scripts/shaolin-lint.mjs | coloringbook-svelte@0.0.1 assumption:alarm | node scripts/assumption-alarm.mjs | coloringbook-svelte@0.0.1 seam:ledger | node scripts/seam-ledger.mjs | coloringbook-svelte@0.0.1 clan:chain | node scripts/clan-chain.mjs | coloringbook-svelte@0.0.1 proof:tape | node scripts/proof-tape.mjs
- probe-chat-interpretation.txt (69 bytes)
- probe-image-generation.txt (82 bytes)
- probe-provider-adapter.txt (79 bytes)
- proof-tape.json (6362 bytes)
- proof-tape.md (2295 bytes)
- rewind-AuthContextSeam.txt (464 bytes)
- rewind-ChatInterpretationSeam.txt (472 bytes)
- rewind-CreationStoreSeam.txt (465 bytes)
- rewind-DriftDetectionSeam.txt (467 bytes)
- rewind-ImageGenerationSeam.txt (469 bytes)
- rewind-MeechieToolSeam.txt (462 bytes)
- rewind-OutputPackagingSeam.txt (467 bytes)
- rewind-PromptAssemblySeam.txt (466 bytes)
- rewind-ProviderAdapterSeam.txt (469 bytes)
- rewind-SessionSeam.txt (457 bytes)
- rewind-SpecValidationSeam.txt (465 bytes)
- rewind-auth-context-seam.txt (0 bytes)
- seam-ledger.json (10370 bytes)
- seam-ledger.md (1054 bytes)
- shaolin-lint.json (579 bytes)
- test.txt (1092 bytes)
  Commands: coloringbook-svelte@0.0.1 test | vitest run
- verify.txt (1333 bytes)
  Commands: coloringbook-svelte@0.0.1 check | svelte-kit sync && svelte-check --tsconfig ./tsconfig.json | coloringbook-svelte@0.0.1 test | vitest run

