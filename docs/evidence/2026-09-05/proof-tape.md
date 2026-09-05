<!--
Purpose: Summarize evidence artifacts in plain language.
Why: Help non-coders understand proof coverage without reading code.
Info flow: evidence files -> summary -> review.
-->
# Proof Tape

Generated at: 2026-09-05T04:17:45.768Z
Evidence folder: docs/evidence/2026-09-05

Files included (this tape's own outputs, proof-tape.json and proof-tape.md, are written
after this inventory is taken, so they are not listed):

- assumption-alarm.json (25717 bytes)
- build.txt (11391 bytes)
  Commands: meechies-coloringbook@0.1.0 build | vite build | Using @sveltejs/adapter-vercel
- chamber-lock.json (28496 bytes)
- cipher-gate-run.txt (429 bytes)
  Commands: meechies-coloringbook@0.1.0 cipher:gate | node scripts/cipher-gate.mjs
- cipher-gate.json (4165 bytes)
- clan-chain.json (2532 bytes)
- clan-chain.md (1559 bytes)
- e2e.txt (4529 bytes)
  Commands: meechies-coloringbook@0.1.0 test:e2e | playwright test
- lint.txt (260 bytes)
  Commands: meechies-coloringbook@0.1.0 lint | eslint .
- rewind-ClockSeam.txt (381 bytes)
- rewind-CreationStoreSeam.txt (377 bytes)
- rewind-DriftDetectionSeam(self-contained).txt (377 bytes)
- rewind-DriftDetectionSeam.txt (377 bytes)
- rewind-ImageGenerationSeam.txt (375 bytes)
- rewind-ImageProviderConfigSeam.txt (375 bytes)
- rewind-MeechieToolSeam(self-contained).txt (377 bytes)
- rewind-MeechieToolSeam.txt (377 bytes)
- rewind-MeechieVoiceSeam(self-contained).txt (379 bytes)
- rewind-MeechieVoiceSeam.txt (377 bytes)
- rewind-OutputPackagingSeam.txt (478 bytes)
- rewind-PromptAssemblySeam(self-contained).txt (380 bytes)
- rewind-PromptAssemblySeam.txt (377 bytes)
- rewind-ProviderAdapterSeam.txt (378 bytes)
- rewind-RateLimitSeam.txt (378 bytes)
- rewind-SafetyPolicySeam.txt (379 bytes)
- rewind-SessionSeam.txt (376 bytes)
- rewind-SpecValidationSeam(self-contained).txt (380 bytes)
- rewind-SpecValidationSeam.txt (380 bytes)
- rewind-WigCatalogSeam.txt (540 bytes) — PREDATES THIS VERIFY RUN
- rewind-wig-catalog-seam.txt (446 bytes) — PREDATES THIS VERIFY RUN
  Commands: meechies-coloringbook@0.1.0 rewind | node scripts/rewind.mjs --seam WigCatalogSeam
- seam-ledger.json (30250 bytes)
- seam-ledger.md (2409 bytes)
- seam-rewind-exit-codes.md (2021 bytes)
- shaolin-lint.json (519 bytes)
- test.txt (831 bytes)
  Commands: meechies-coloringbook@0.1.0 test | vitest run --pool=forks --maxWorkers=1
- verify-chain-run.txt (1556 bytes)
  Commands: meechies-coloringbook@0.1.0 verify | npm run audit:gate && node scripts/chamber-lock.mjs && node scripts/verify-runner.mjs && node scripts/shaolin-lint.mjs && node scripts/assumption-alarm.mjs && node scripts/seam-ledger.mjs && node scripts/clan-chain.mjs && node scripts/proof-tape.mjs | meechies-coloringbook@0.1.0 audit:gate | npm audit --audit-level=high | meechies-coloringbook@0.1.0 check | svelte-kit sync && svelte-check --tsconfig ./tsconfig.json | meechies-coloringbook@0.1.0 test | vitest run --pool=forks --maxWorkers=1
- verify-chain.txt (10925 bytes) — PREDATES THIS VERIFY RUN
- verify.txt (1156 bytes)
  Commands: meechies-coloringbook@0.1.0 check | svelte-kit sync && svelte-check --tsconfig ./tsconfig.json | meechies-coloringbook@0.1.0 test | vitest run --pool=forks --maxWorkers=1

Older than this run's chamber-lock.json: rewind-WigCatalogSeam.txt, rewind-wig-catalog-seam.txt, verify-chain.txt.
These files were written by an earlier run, so they describe a different run than
the one this tape summarizes. Regenerate them or read them as history, not as proof
of the current change.
