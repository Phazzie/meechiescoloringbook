<!--
Purpose: Summarize evidence artifacts in plain language.
Why: Help non-coders understand proof coverage without reading code.
Info flow: evidence files -> summary -> review.
-->
# Proof Tape

Generated at: 2026-08-25T03:19:02.084Z
Evidence folder: docs/evidence/2026-08-25

Files included:
- assumption-alarm.json (5063 bytes)
- chamber-lock.json (24795 bytes)
- cipher-gate.json (3551 bytes)
- clan-chain.json (2247 bytes)
- clan-chain.md (1418 bytes)
- prompt-boundary-live-README.md (2476 bytes)
- prompt-boundary-live-prompt.txt (1059 bytes)
- prompt-boundary-live-request.json (1911 bytes)
- prompt-boundary-live-response.json (423 bytes)
- proof-tape.json (6804 bytes)
- proof-tape.md (1763 bytes)
- rewind-AppConfigSeam.txt (402 bytes)
- rewind-ChatInterpretationSeam.txt (405 bytes)
- rewind-DriftDetectionSeam(self-contained).txt (402 bytes)
- rewind-DriftDetectionSeam.txt (403 bytes)
- rewind-ImageGenerationSeam.txt (402 bytes)
- rewind-ImageProviderConfigSeam.txt (403 bytes)
- rewind-MeechieStudioTextSeam.txt (404 bytes)
- rewind-MeechieToolSeam(self-contained).txt (404 bytes)
- rewind-MeechieVoiceSeam(self-contained).txt (407 bytes)
- rewind-PromptAssemblySeam(self-contained).txt (407 bytes)
- rewind-PromptAssemblySeam.txt (405 bytes)
- rewind-ProviderAdapterSeam.txt (405 bytes)
- rewind-SpecValidationSeam.txt (408 bytes)
- seam-ledger.json (26323 bytes)
- seam-ledger.md (2168 bytes)
- shaolin-lint.json (519 bytes)
- test.txt (1136 bytes)
  Commands: meechies-coloringbook@0.1.0 test | vitest run --pool=forks --maxWorkers=1
- verify.txt (1768 bytes)
  Commands: meechies-coloringbook@0.1.0 check | svelte-kit sync && svelte-check --tsconfig ./tsconfig.json | meechies-coloringbook@0.1.0 test | vitest run --pool=forks --maxWorkers=1
