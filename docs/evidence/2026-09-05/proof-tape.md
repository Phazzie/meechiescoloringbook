<!--
Purpose: Summarize evidence artifacts in plain language.
Why: Help non-coders understand proof coverage without reading code.
Info flow: evidence files -> summary -> review.
-->
# Proof Tape

Generated at: 2026-09-05T19:35:40.405Z
Evidence folder: docs/evidence/2026-09-05

Files included (this tape's own outputs, proof-tape.json and proof-tape.md, are written
after this inventory is taken, so they are not listed):

- assumption-alarm.json (12123 bytes)
- build.txt (11138 bytes) — PREDATES THIS VERIFY RUN
  Commands: meechies-coloringbook@0.1.0 build | vite build | Using @sveltejs/adapter-vercel
- chamber-lock.json (35321 bytes)
- cipher-gate.json (1245 bytes) — PREDATES THIS VERIFY RUN
- clan-chain.json (3181 bytes)
- clan-chain.md (1956 bytes)
- e2e.txt (6256 bytes) — PREDATES THIS VERIFY RUN
- lint.txt (162 bytes) — PREDATES THIS VERIFY RUN
  Commands: meechies-coloringbook@0.1.0 lint | eslint .
- probe-browser-seams.txt (3054 bytes) — PREDATES THIS VERIFY RUN
- rewind-AuthContextSeam(self-contained).txt (658 bytes) — PREDATES THIS VERIFY RUN
- rewind-AuthContextSeam.txt (654 bytes) — PREDATES THIS VERIFY RUN
- rewind-ChatInterpretationSeam(self-contained).txt (665 bytes) — PREDATES THIS VERIFY RUN
- rewind-ChatInterpretationSeam.txt (662 bytes) — PREDATES THIS VERIFY RUN
- rewind-CreationStoreSeam(self-contained).txt (542 bytes) — PREDATES THIS VERIFY RUN
- rewind-CreationStoreSeam-self-contained.txt (482 bytes) — PREDATES THIS VERIFY RUN
  Commands: meechies-coloringbook@0.1.0 rewind | node scripts/rewind.mjs --seam CreationStoreSeam (self-contained)
- rewind-CreationStoreSeam.txt (539 bytes) — PREDATES THIS VERIFY RUN
- rewind-MeechieStudioTextSeam(self-contained).txt (664 bytes) — PREDATES THIS VERIFY RUN
- rewind-MeechieStudioTextSeam.txt (662 bytes) — PREDATES THIS VERIFY RUN
- rewind-OutputPackagingSeam(self-contained).txt (662 bytes) — PREDATES THIS VERIFY RUN
- rewind-OutputPackagingSeam.txt (761 bytes) — PREDATES THIS VERIFY RUN
- rewind-ProviderAdapterSeam(self-contained).txt (662 bytes) — PREDATES THIS VERIFY RUN
- rewind-ProviderAdapterSeam.txt (660 bytes) — PREDATES THIS VERIFY RUN
- rewind-SessionSeam(self-contained).txt (652 bytes) — PREDATES THIS VERIFY RUN
- rewind-SessionSeam.txt (648 bytes) — PREDATES THIS VERIFY RUN
- rewind-WigCatalogSeam.txt (540 bytes) — PREDATES THIS VERIFY RUN
- rewind-wig-catalog-seam.txt (446 bytes) — PREDATES THIS VERIFY RUN
  Commands: meechies-coloringbook@0.1.0 rewind | node scripts/rewind.mjs --seam WigCatalogSeam
- seam-ledger.json (37460 bytes)
- seam-ledger.md (2981 bytes)
- shaolin-lint.json (517 bytes)
- test.txt (3131 bytes)
  Commands: meechies-coloringbook@0.1.0 test | vitest run --pool=forks --maxWorkers=1
- verify-chain.txt (13945 bytes) — PREDATES THIS VERIFY RUN
- verify-outer.txt (4438 bytes) — PREDATES THIS VERIFY RUN
  Commands: meechies-coloringbook@0.1.0 verify | npm run audit:gate && node scripts/chamber-lock.mjs && node scripts/verify-runner.mjs && node scripts/shaolin-lint.mjs && node scripts/assumption-alarm.mjs && node scripts/seam-ledger.mjs && node scripts/clan-chain.mjs && node scripts/proof-tape.mjs | meechies-coloringbook@0.1.0 audit:gate | npm audit --audit-level=high | meechies-coloringbook@0.1.0 check | svelte-kit sync && svelte-check --tsconfig ./tsconfig.json | meechies-coloringbook@0.1.0 test | vitest run --pool=forks --maxWorkers=1
- verify.txt (3456 bytes)
  Commands: meechies-coloringbook@0.1.0 check | svelte-kit sync && svelte-check --tsconfig ./tsconfig.json | meechies-coloringbook@0.1.0 test | vitest run --pool=forks --maxWorkers=1

Older than this run's chamber-lock.json: build.txt, cipher-gate.json, e2e.txt, lint.txt, probe-browser-seams.txt, rewind-AuthContextSeam(self-contained).txt, rewind-AuthContextSeam.txt, rewind-ChatInterpretationSeam(self-contained).txt, rewind-ChatInterpretationSeam.txt, rewind-CreationStoreSeam(self-contained).txt, rewind-CreationStoreSeam-self-contained.txt, rewind-CreationStoreSeam.txt, rewind-MeechieStudioTextSeam(self-contained).txt, rewind-MeechieStudioTextSeam.txt, rewind-OutputPackagingSeam(self-contained).txt, rewind-OutputPackagingSeam.txt, rewind-ProviderAdapterSeam(self-contained).txt, rewind-ProviderAdapterSeam.txt, rewind-SessionSeam(self-contained).txt, rewind-SessionSeam.txt, rewind-WigCatalogSeam.txt, rewind-wig-catalog-seam.txt, verify-chain.txt, verify-outer.txt.
These files were written by an earlier run, so they describe a different run than
the one this tape summarizes. Regenerate them or read them as history, not as proof
of the current change.
