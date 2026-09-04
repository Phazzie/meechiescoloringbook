<!--
Purpose: Summarize evidence artifacts in plain language.
Why: Help non-coders understand proof coverage without reading code.
Info flow: evidence files -> summary -> review.
-->
# Proof Tape

Generated at: 2026-09-04T20:25:56.015Z
Evidence folder: docs/evidence/2026-09-04

Files included (this tape's own outputs, proof-tape.json and proof-tape.md, are written
after this inventory is taken, so they are not listed):

- assumption-alarm.json (12123 bytes)
- build.txt (11485 bytes)
  Commands: meechies-coloringbook@0.1.0 build | vite build | Using @sveltejs/adapter-vercel
- chamber-lock.json (28496 bytes)
- cipher-gate.json (3509 bytes) — PREDATES THIS VERIFY RUN
- clan-chain.json (2532 bytes)
- clan-chain.md (1559 bytes)
- e2e.txt (4693 bytes)
- lint.txt (630 bytes)
  Commands: meechies-coloringbook@0.1.0 lint | eslint .
- rewind-ClockSeam.txt (542 bytes)
- rewind-CreationStoreSeam.txt (539 bytes)
- rewind-DriftDetectionSeam(self-contained).txt (539 bytes)
- rewind-DriftDetectionSeam.txt (539 bytes)
- rewind-ImageGenerationSeam.txt (537 bytes)
- rewind-ImageProviderConfigSeam.txt (537 bytes)
- rewind-MeechieToolSeam(self-contained).txt (539 bytes)
- rewind-MeechieToolSeam.txt (539 bytes)
- rewind-MeechieVoiceSeam(self-contained).txt (541 bytes)
- rewind-MeechieVoiceSeam.txt (539 bytes)
- rewind-OutputPackagingSeam.txt (639 bytes)
- rewind-PromptAssemblySeam(self-contained).txt (542 bytes)
- rewind-PromptAssemblySeam.txt (539 bytes)
- rewind-ProviderAdapterSeam.txt (540 bytes)
- rewind-RateLimitSeam.txt (540 bytes)
- rewind-SafetyPolicySeam.txt (540 bytes)
- rewind-SessionSeam.txt (537 bytes)
- rewind-SpecValidationSeam(self-contained).txt (542 bytes)
- rewind-SpecValidationSeam.txt (542 bytes)
- seam-ledger.json (30250 bytes)
- seam-ledger.md (2409 bytes)
- shaolin-lint.json (519 bytes)
- test.txt (1031 bytes)
  Commands: meechies-coloringbook@0.1.0 test | vitest run --pool=forks --maxWorkers=1
- verify-chain.txt (12680 bytes)
- verify.txt (1356 bytes)
  Commands: meechies-coloringbook@0.1.0 check | svelte-kit sync && svelte-check --tsconfig ./tsconfig.json | meechies-coloringbook@0.1.0 test | vitest run --pool=forks --maxWorkers=1

Older than this run's chamber-lock.json: cipher-gate.json.
These files were written by an earlier run, so they describe a different run than
the one this tape summarizes. Regenerate them or read them as history, not as proof
of the current change.
