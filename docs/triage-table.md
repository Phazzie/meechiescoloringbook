<!--
Purpose: Classify every OPEN pull request against current `origin/main`, with a disposition for each.
Why: This file is the input to `scripts/analyze-merge-conflicts.js` — that script reads the PR
     numbers out of the rows below and rewrites the merge-status column. A table listing PRs that
     closed months ago therefore does not merely go stale, it sends the tool to re-measure dead
     branches and reports nothing about the ones that are live.
Info flow: `gh pr list` / merge tests against origin/main -> this table -> merge or close decisions.
-->
# Live PR Triage Table

Last refreshed: **2026-09-11**, against `origin/main` at `f1a8c91`.

Merge status is `git merge-tree --write-tree origin/main <head>`: **CLEAN** means git produced a
tree, **CONFLICT** means it named conflicting paths. Every open PR below carries content `main` does
not have — none of them is a duplicate of something already merged, which is the thing worth
checking first and the reason each row says what is missing rather than only that the PR is old.

| PR | Title | Head | Merge status | Content `main` lacks | Disposition |
| --- | --- | --- | --- | --- | --- |
| #348 | chore(deps): bump @vitest/mocker 4.1.0 -> 4.1.11 | `dependabot/npm_and_yarn/npm_and_yarn-ea5d8ae93f` | CLEAN | The lockfile fix for GHSA-82fw-gwwq-j7x9 (`@vitest/mocker` path traversal, moderate). `npm audit` on `main` reports it. | **Superseded.** The same bump is on `claude/kind-volta-onychh`, regenerated against current `main` — dependabot's lockfile predates `52c5d7e`, which changed `package-lock.json`, so its lock would be a partial revert. Close once that lands. |
| #338 | docs: record the Run 18 merge close-out | `claude/great-bell-iex3wp` | CONFLICT (`WORST_TO_BEST_LOG.md`, `plan.md`) | `main`'s log goes from `## Run 18` straight to `## Run 19` — Run 18 has no merge close-out entry. | **Port the log entry.** The log is append-only, so the conflict is a both-sides append, not a disagreement. |
| #328 | Fix safety-keyword parity gap (closes #327) | `claude/trusting-volta-r7xqzl` | CONFLICT (docs and evidence only; the two source files are clean) | Nothing now. | **Superseded.** Ported to `claude/kind-volta-onychh` with the parity regression test this PR did not have. Close once that lands; #327 closes with it. |
| #317 | feat(studio): bring back the question the draft's evidence was typed under | `claude/great-bell-k1i146` | CONFLICT | `DraftRecordSchema` on `main` still has no `modeId`, so a reopened draft's `chatMessage` is still restored under whichever mode the studio happens to open on. `src/lib/core/draft-restore.ts` does not exist on `main`. | **Port.** Real live defect, ~866 lines across 13 files including a seam contract — a full Seam-Driven Development port, not a cherry-pick. |
| #308 | fix: a tracked evidence guard, and the eleven claims that needed one | `claude/great-bell-31hg5t` | CONFLICT | `scripts/evidence-guard.mjs`, `scripts/chain-intact.mjs` and their fixtures and tests are absent from `main`. | **Port.** Touches `.github/workflows/verify.yml` and `package.json`; 45 commits behind, so port the guard rather than merging the branch. |
| #296 | Close out Run 4 of the worst-feature routine | `claude/great-bell-sntvn9` | CONFLICT | `main`'s log has Run 4's first and second close-outs and then jumps to Run 5 — `## Run 4, merged` and its six corrections are missing. | **Port the log entries.** Append-only, as #338. |

## What the previous version of this file said, and why it is gone

Until this refresh the table held 45 rows for PRs #60–#140. **Every one of them is closed** — no pull
request numbered below #296 is open. It also carried the literal string `Has conflicts: .` in 45
rows, naming no files: a generator bug recorded in `QUICK_WINS_LOG.md`, which defeated the column's
entire purpose. Both facts made the same table simultaneously wrong about which PRs exist and useless
about the one thing it measured.

The older backlog triage that produced those rows — `docs/evidence/2026-06-07/pr-containment-ledger.md`,
`docs/hpr-pr-resolution-ledger-2026-06-05.md` and the running count in issue #175 — recommended
picking one PR per branch family, closing the rest as superseded, and pausing the schedule that kept
spawning them. That recommendation was carried out: the backlog those documents describe (26 open
growing to 50, with zero merges for 20 days) is drained. Read them as history. This table is the
only one of them that a script still reads, which is why it is the only one rewritten rather than
left in place.
