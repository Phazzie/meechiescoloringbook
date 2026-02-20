<!--
Purpose: Provide an immediate resume snapshot after autonomous refactor/UI work.
Why: Keep current branch state, blockers, and next commands clear when work resumes.
Info flow: Latest local state -> blocker details -> exact next actions.
-->
# Handoff (2026-02-16)

## Current state
- Branch: `main`
- Remote delta: `main` is **ahead of `origin/main` by 3 commits**.
- Latest local commits not on remote:
  1. `3aae5aa` `feat(ui): redesign studio and meechie voice experience`
  2. `5830466` `refactor(core): extract generation pipelines and align governance`
  3. `00dd3c6` `refactor(core): retire legacy generation workflow path`

## Push blocker
- `git push origin main` repeatedly fails **after hooks/tests pass** with:
  - `error: RPC failed; HTTP 400 curl 22 The requested URL returned error: 400`
  - `send-pack: unexpected disconnect while reading sideband packet`
  - `fatal: the remote end hung up unexpectedly`

## Validation status
- `npm run check`: pass
- `npm test`: pass (`23 passed`, `1 skipped`)
- `npm run verify`: pass locally before push handoff to remote transport

## Working tree note
- The pre-push hook refreshes evidence outputs, so these files are currently modified:
  - `docs/evidence/2026-02-15/assumption-alarm.json`
  - `docs/evidence/2026-02-15/chamber-lock.json`
  - `docs/evidence/2026-02-15/cipher-gate.json`
  - `docs/evidence/2026-02-15/clan-chain.json`
  - `docs/evidence/2026-02-15/clan-chain.md`
  - `docs/evidence/2026-02-15/proof-tape.json`
  - `docs/evidence/2026-02-15/proof-tape.md`
  - `docs/evidence/2026-02-15/seam-ledger.json`
  - `docs/evidence/2026-02-15/seam-ledger.md`
  - `docs/evidence/2026-02-15/shaolin-lint.json`
  - `docs/evidence/2026-02-15/test.txt`
  - `docs/evidence/2026-02-15/verify.txt`

## Fast resume commands
1. Confirm ahead/behind:
   - `git status -sb`
   - `git log --oneline --decorate -5`
2. Retry push (HTTPS):
   - `git push origin main`
3. If HTTPS still fails, switch to SSH remote and push:
   - `git remote set-url origin git@github.com:phazzie/meechiescoloringbook.git`
   - `git push origin main`

## Context summary
- Requested sequence `3 then 1` is complete:
  - Two-commit split completed first (UI/copy, then architecture/governance).
  - Ghost workflow retirement completed after that.
- Gemini finding #7 (ghost workflow) was moved from deferred to fixed in docs.
