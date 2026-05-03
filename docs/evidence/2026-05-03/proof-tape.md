<!--
Purpose: Summarize evidence artifacts in plain language.
Why: Help non-coders understand proof coverage without reading code.
Info flow: evidence files -> summary -> review.
-->
# Proof Tape

Generated at: 2026-05-03T21:56:47.629Z
Evidence folder: docs\evidence\2026-05-03

Files included:
- assumption-alarm.json (2297 bytes)
- chamber-lock.json (16122 bytes)
- check.txt (324 bytes)
- cipher-gate.json (1127 bytes)
- clan-chain.json (1743 bytes)
- clan-chain.md (1125 bytes)
- dev-server-hero.err.log (0 bytes)
- dev-server-hero.log (236 bytes)
  Commands: meechies-coloringbook@0.1.0 dev | vite dev --host 127.0.0.1 --port 5173
- dev-server-hero.pid (7 bytes)
- hero-browser-smoke.json (1969 bytes)
- hero-desktop.png (1424548 bytes)
- hero-mobile-rerun.json (531 bytes)
- hero-mobile-rerun.png (726400 bytes)
- hero-mobile.png (726400 bytes)
- proof-tape.json (2674 bytes)
- proof-tape.md (938 bytes)
- seam-ledger.json (17148 bytes)
- seam-ledger.md (1482 bytes)
- shaolin-lint.json (605 bytes)
- targeted-review-regressions.txt (1536 bytes)
- test.txt (6102 bytes)
  Commands: meechies-coloringbook@0.1.0 test | vitest run --pool=forks --maxWorkers=1
- verify.txt (6449 bytes)
  Commands: meechies-coloringbook@0.1.0 check | svelte-kit sync && svelte-check --tsconfig ./tsconfig.json | meechies-coloringbook@0.1.0 test | vitest run --pool=forks --maxWorkers=1
