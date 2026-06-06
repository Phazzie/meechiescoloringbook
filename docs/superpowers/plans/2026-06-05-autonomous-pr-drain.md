<!--
Purpose: Define the autonomous PR-drain runbook for the current cleanup effort.
Why: Let the maintainer step away while keeping scope, stop rules, self-critique, tests, and evidence gates explicit.
Info flow: Live GitHub state -> Handoff PR Resolution ledger -> small replacement PRs -> validation evidence -> old PR closure notes.
-->

# Autonomous PR Drain Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Drain the open PR backlog through several small, reviewable replacement PRs while preserving useful behavior, passing tests, and recording every decision in a Handoff PR Resolution ledger.

**Architecture:** Use current `main` as the source of truth, refresh live GitHub state, then create one small branch per workpack. Each workpack lands a focused behavior change, updates the ledger, runs targeted and full validation gates, and only then comments on or closes the old PRs it supersedes after the replacement work is merged or explicitly marked as blocked. Broad or stale PRs are not closed until a final salvage audit confirms nothing valuable remains.

**Tech Stack:** SvelteKit, TypeScript, Vitest, Playwright when available, GitHub CLI, repo Seam-Driven Development governance.

---

## Autonomy Contract

- Work may proceed without user input through planning, branch creation, code edits, tests, self-critique, revision, ledger updates, PR creation, and PR comments if GitHub permissions allow it.
- Before leaving the planning branch, commit or stash this runbook work. Do not run `git checkout main` with a dirty worktree.
- Closing old PRs is allowed only after the replacement work is on `main`, or after the ledger records that the old PR has no useful salvage and the closure comment has been posted. If a replacement PR is still open, comment with "closure pending replacement merge" instead of closing the old PR.
- Merging replacement PRs is allowed only when GitHub branch protection allows it, required checks pass, the workpack validation commands are recorded in the ledger, and the PR contains only the planned workpack scope. If merge is blocked by review requirements or permissions, leave the replacement PR open and record the blocker.
- Stop and report `BLOCKED` only when GitHub authentication is missing, a command requires credentials that are not present, a test failure cannot be classified after three focused debugging attempts, a product decision is required, or the requested action would discard user work.
- Do not merge or close a PR solely because the original plan said it was stale. Inspect the live PR diff and review threads first, including non-`main` base PRs such as #92.
- Do not close the broad-audit bucket until the final audit task records what was salvaged or skipped.
- Do not claim completion without command output or a ledger entry that names the failed command and the blocker.
- If a workpack needs to touch a file not listed in its `Files` section, stop that workpack, update this plan and the ledger first, then continue. Phrases such as "if needed" are not permission to edit outside the listed file set.

## Hard Stop Gates

- Dirty worktree gate: `git status --short --branch` must show no modified or untracked files before branch switches, pulls, merges, rebases, cherry-picks, or old-PR closure.
- Coverage gate: the set of PR numbers in `docs/evidence/2026-06-05/hpr-pr-live-state/open-prs.json` must exactly match ledger rows that have a final state, replacement PR link or blocker, validation evidence, and closure/comment URL.
- Review-thread gate: every open PR must have review-thread evidence. Any `hasNextPage: true` in thread or comment pagination blocks disposition until the remaining pages are captured.
- CI gate: each replacement PR must run GitHub checks with the real replacement PR number, for example `gh pr checks $replacementPrNumber --watch`. If a check fails, inspect the real failed run with `gh run view $failedRunId --log-failed` and record the failing output path in the ledger.
- Closure gate: old PR closure is forbidden until either the replacement PR has merged to `main`, or the final broad-audit entry proves no code/test/doc salvage was needed and the closure comment URL is recorded.
- Dependency gate: Dependabot PR closure requires advisory/security review, current CI state, and either a superseding Dependabot PR or explicit user approval. Otherwise leave it open with a comment.
- Seam gate: any seam change must follow the full Seam-Driven Development workflow: contract/probe/fixtures/mock/test/adapter review, fault fixture red proof where applicable, `npm.cmd run verify`, `npm.cmd run cipher:gate` when required, and evidence files linked from the ledger.

## Shortcuts To Avoid Before Each Workpack

- Shortcut: trust the May 30 PR map. Countermeasure: refresh `gh pr list`, `gh issue list`, `gh pr view`, and review threads before coding.
- Shortcut: merge old PR branches wholesale. Countermeasure: port behavior onto current `main` using small branches and focused diffs.
- Shortcut: treat passing unit tests as enough. Countermeasure: run the workpack-specific test, then `npm.cmd run check`, `npm.cmd run lint`, `npm.cmd test`, and `npm.cmd run build` before final disposition.
- Shortcut: close broad PRs without salvage. Countermeasure: keep the broad-audit bucket open until the final audit pass.
- Shortcut: let generated evidence churn hide real code changes. Countermeasure: review `git diff --stat`, `git diff --check`, and ledger the meaningful files separately from generated evidence.

## Global Files And Ledgers

- Create: `docs/hpr-pr-resolution-ledger-2026-06-05.md`
- Create: `docs/evidence/2026-06-05/hpr-pr-live-state/open-prs.json`
- Create: `docs/evidence/2026-06-05/hpr-pr-live-state/open-issues.json`
- Create as needed: `docs/evidence/2026-06-05/hpr-pr-live-state/pr-NUMBER.json` where `NUMBER` is the actual PR number.
- Create as needed: `docs/evidence/2026-06-05/hpr-pr-live-state/pr-NUMBER-review-threads.json` where `NUMBER` is the actual PR number.
- Create as needed: `docs/evidence/2026-06-05/hpr-pr-live-state/pr-NUMBER-diff-stat.txt` where `NUMBER` is the actual PR number.
- Modify for this runbook only: `plan.md`
- Modify for implementation workpacks only when governance requires it: `DECISIONS.md`, `LESSONS_LEARNED.md`, `CHANGELOG.md`

All Markdown files created by this plan must start with a Purpose/Why/Info flow header.

## Branch And PR Model

- Planning branch: `codex/autonomous-pr-drain-plan-2026-06-05`
- Ledger/baseline branch: `codex/hpr-ledger-baseline-2026-06-05`
- Workpack branches:
  - `codex/hpr-http-error-policy-2026-06-05`
  - `codex/hpr-generate-image-seam-2026-06-05`
  - `codex/hpr-safety-policy-generate-gate-2026-06-05`
  - `codex/hpr-timeout-abort-policy-2026-06-05`
  - `codex/hpr-studio-text-recovery-2026-06-05`
  - `codex/hpr-studio-state-ui-hardening-2026-06-05`
  - `codex/hpr-fixture-mock-discipline-2026-06-05`
  - `codex/hpr-lint-e2e-audit-2026-06-05`
  - `codex/hpr-dependency-bump-2026-06-05`
  - `codex/hpr-broad-pr-salvage-audit-2026-06-05`

Default branch policy:

- If the previous required workpack has merged, start the next dependent branch from latest `origin/main`.
- If a later workpack depends on an unmerged replacement PR, stack it on that replacement branch and set the GitHub PR base to the previous replacement branch.
- If a workpack is independent, start it from latest `origin/main`.
- Never base new work on an old PR branch. Non-`main` base PRs are manual-port candidates only.
- If branch protection or review policy blocks merging replacement PRs while the user is away, continue only with independent branches from latest `origin/main`. For dependent work, stack branches explicitly and record the stack order in the ledger.

## Current Live Snapshot From 2026-06-05

This snapshot came from `gh pr list --state open --limit 200` on 2026-06-05. Refresh it again in Task 1 before implementation; if it changes, update the ledger before coding.

Exact open PR set observed: `127,126,125,124,123,122,121,120,119,118,117,116,115,114,113,112,111,110,109,108,107,106,105,104,102,101,100,99,98,95,94,92,89,88,87,86,85,82,81,80,79,77,74,73,72,71,60`.

Exact open issue set observed: `1`.

| Bucket | Current PRs | Workpack action |
| --- | --- | --- |
| Ledger/spec only | Issue #1 | Keep open as product spec unless owner says otherwise. |
| Current seam migration and seam cleanup | #127, #121, #102, #89, #73 | Audit carefully. Port only focused self-contained seam pieces that reduce duplication without broad migration churn. Keep #73 in final broad audit. |
| Current studio-state extraction and UI follow-up | #125, #124, #123, #117, #111, #104, #92, #81 | Review #124/#125 as the lead for `src/routes/studio-state.svelte.ts`; port only if tests prove behavior parity. Fold smaller UI quick wins into the studio-state/UI workpack. |
| Current review-follow-up chain for #105/#109/#116 | #122, #119, #116, #113, #110, #109, #106, #105, #94 | Use the newest live follow-up as evidence, but do not merge the chain wholesale. Mine fixture/mock/design fixes into the fixture/mock discipline workpack. |
| Generate and safety path | #115, #112, #74 | Split into generate-through-seam first, then safety gate. Preserve structured error payloads and status mappings. |
| HTTP error policy and quick wins | #126, #120, #118, #114, #107, #101, #99, #88, #86, #77, #72 | Mine small tests and fixes only after the central `postJson` policy is locked. Avoid structured-error regressions. |
| Timeout and resilience | #108, #100, #95, #85 | Implement conservative timeout/abort behavior without automatic retries for billable non-idempotent POSTs. |
| Studio text recovery | #98 | Port only after schema/parse/runtime-mode review fixes are covered by tests. |
| Lint, E2E, generated tests, dependency | #87, #82, #80, #79, #71, #60 | Handle late. Keep generated tests only if meaningful and compiling. Treat dependency bump last. |

## Command Gates

Use this helper for every command whose output is cited as evidence. It writes exact command output and fails immediately on nonzero exit:

```powershell
function Invoke-HprCommand {
  param(
    [Parameter(Mandatory = $true)][string]$EvidencePath,
    [Parameter(Mandatory = $true)][scriptblock]$Command
  )

  New-Item -ItemType Directory -Force (Split-Path -Parent $EvidencePath) | Out-Null
  & $Command *> $EvidencePath
  $exitCode = if ($LASTEXITCODE -ne $null) { $LASTEXITCODE } else { 0 }
  if ($exitCode -ne 0) {
    throw "Command failed with exit code $exitCode. Evidence: $EvidencePath"
  }
}
```

Workpack evidence prefixes:

| Workpack | Evidence prefix |
| --- | --- |
| Baseline ledger | `docs/evidence/2026-06-05/hpr-baseline` |
| HTTP error policy | `docs/evidence/2026-06-05/hpr-http-error-policy` |
| Generate through ImageGenerationSeam | `docs/evidence/2026-06-05/hpr-generate-image-seam` |
| SafetyPolicySeam generate gate | `docs/evidence/2026-06-05/hpr-safety-policy-generate-gate` |
| Timeout and abort policy | `docs/evidence/2026-06-05/hpr-timeout-abort-policy` |
| MeechieStudioTextPipeline recovery | `docs/evidence/2026-06-05/hpr-studio-text-recovery` |
| Studio state and UI hardening | `docs/evidence/2026-06-05/hpr-studio-state-ui-hardening` |
| Fixture and mock discipline | `docs/evidence/2026-06-05/hpr-fixture-mock-discipline` |
| Lint, E2E, and generated test audit | `docs/evidence/2026-06-05/hpr-lint-e2e-audit` |
| Dependency bump | `docs/evidence/2026-06-05/hpr-dependency-bump` |
| Broad PR salvage audit | `docs/evidence/2026-06-05/hpr-broad-pr-salvage-audit` |

Run these at the start of the run:

```powershell
$ErrorActionPreference = 'Stop'
git status --short --branch
git fetch origin
git fetch origin '+refs/pull/*/head:refs/remotes/origin/pr/*'
git checkout main
git pull --ff-only
gh pr list --state open --limit 200 --json number,title,headRefName,baseRefName,mergeStateStatus,isDraft,updatedAt,url | Tee-Object docs/evidence/2026-06-05/hpr-pr-live-state/open-prs.json | ConvertFrom-Json | Out-Null
gh issue list --state open --limit 200 --json number,title,url | Tee-Object docs/evidence/2026-06-05/hpr-pr-live-state/open-issues.json | ConvertFrom-Json | Out-Null
npm.cmd ci
npm.cmd run check
npm.cmd run lint
npm.cmd test
npm.cmd run build
```

For each PR number discovered, resolve its captured base branch before diffing. Do not hard-code `main`:

```powershell
$pr = gh pr view <PR_NUMBER> --json number,title,body,files,comments,reviews,reviewDecision,mergeStateStatus,baseRefName,headRefName,url | ConvertFrom-Json
$baseRef = "origin/$($pr.baseRefName)"
git show-ref --verify --quiet "refs/remotes/origin/pr/$($pr.number)"
if ($LASTEXITCODE -ne 0) { throw "Missing origin/pr/$($pr.number)" }
git show-ref --verify --quiet "refs/remotes/$baseRef"
if ($LASTEXITCODE -ne 0) { git fetch origin $pr.baseRefName }
git diff "$baseRef...origin/pr/$($pr.number)" --stat
```

If any review-thread query returns `hasNextPage: true`, keep paginating before deciding that all threads were inspected. If any comment connection returns `hasNextPage: true`, fetch the remaining comments before deciding whether the thread is obsolete.

Run these before each replacement PR is opened:

```powershell
$prefix = 'docs/evidence/2026-06-05/hpr-http-error-policy'
Invoke-HprCommand "$prefix-check.txt" { npm.cmd run check }
Invoke-HprCommand "$prefix-lint.txt" { npm.cmd run lint }
Invoke-HprCommand "$prefix-test.txt" { npm.cmd test }
Invoke-HprCommand "$prefix-build.txt" { npm.cmd run build }
Invoke-HprCommand "$prefix-verify.txt" { npm.cmd run verify }
Invoke-HprCommand "$prefix-diff-check.txt" { git diff --check }
Invoke-HprCommand "$prefix-git-status.txt" { git status --short --branch }
```

Use the evidence prefix for the active workpack from the table above; the `hpr-http-error-policy` value is an example of the exact pattern.

If `npm.cmd run verify` fails due local disk, heap, or temp-space conditions, run the failing subcommand directly, record the exact failure in the ledger, and do not mark the workpack fully validated.

After each replacement PR is opened, run:

```powershell
$prefix = 'docs/evidence/2026-06-05/hpr-http-error-policy'
$replacementPrNumber = 128
Invoke-HprCommand "$prefix-gh-checks.txt" { gh pr checks $replacementPrNumber --watch }
```

Replace `$replacementPrNumber = 128` with the real replacement PR number created for the active workpack. If checks fail, set `$failedRunId` to the real failed run ID, run `gh run view $failedRunId --log-failed` through `Invoke-HprCommand` using the active workpack prefix, and record the evidence path in the ledger.

## Ledger Requirements

The ledger must include these columns:

| PR | Title | Initial bucket | Live status | Action | Files touched | Salvaged content | Review comments handled | Validation evidence | Final state | Close or merge note |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |

The `Final state` field must use one of these values only:

- `open - pending replacement`
- `open - blocked`
- `closed - superseded`
- `merged`
- `kept open - product spec`
- `closure requested`

Issue #1 starts as `kept open - product spec` and must not be closed by this run unless the owner explicitly asks for it.

Before final completion, run this coverage assertion from the repository root after the ledger has been updated:

```powershell
$openPrs = (Get-Content docs/evidence/2026-06-05/hpr-pr-live-state/open-prs.json -Raw | ConvertFrom-Json).number | Sort-Object
$ledger = Get-Content docs/hpr-pr-resolution-ledger-2026-06-05.md -Raw
foreach ($number in $openPrs) {
  if ($ledger -notmatch "\| #?$number \|") { throw "Missing ledger row for PR #$number" }
  if ($ledger -notmatch "#$number[^\n]*(open - pending replacement|open - blocked|closed - superseded|merged|closure requested)") { throw "Missing final state for PR #$number" }
}
```

After every workpack, append a self-critique note with these answers:

1. What changed?
2. Which old PRs does this satisfy or supersede?
3. Which review comments are now handled?
4. Did this preserve structured error payloads?
5. Did this add or update tests?
6. Could this duplicate billing or double-submit provider requests?
7. Did this add direct I/O in core code?
8. Did mocks and fixtures avoid mutation leaks?
9. Did this add stale evidence, stale TODOs, or local machine paths?
10. What remains uncertain?

## Seam-Driven Development Requirements For Seam Workpacks

For every workpack whose `Seams` field is not `none`, complete this checklist before opening the replacement PR:

- Confirm each seam name exists in `docs/seams.md`; if it does not, stop and update the plan before adding a new seam.
- Identify whether the change touches `contracts/`, `probes/`, `fixtures/`, `src/lib/mocks/`, `tests/contract/`, `src/lib/seams/`, or `src/lib/adapters/`.
- If a seam boundary or observable behavior changes, follow the full Seam-Driven Development workflow: contract, probe or documented blocked probe, fresh fixtures or waiver, mock, contract test, adapter.
- Run the mock or contract test first in a red-proof mode where practical: the relevant fault fixture must fail before the adapter or production behavior change is accepted.
- Verify mocks load fixtures by scenario and do not invent response data.
- Verify fault fixtures are passed as `unknown` to validators when testing invalid data.
- Verify adapters do not import `fs` or `fs.promises` directly, do not use sync I/O, and do not call `process.cwd()` from core logic.
- Run `npm.cmd run rewind -- --seam <ExactSeamName>` for each changed seam where the repo supports rewind.
- Run `npm.cmd run verify` for every seam change.
- Run `npm.cmd run cipher:gate` and update `DECISIONS.md` when Cipher Gate is required by the repo governance.
- Link exact evidence files from `docs/evidence/2026-06-05/` in the ledger.

The only exception is a docs/comments/formatting-only change with zero behavioral impact. If there is doubt, treat it as a seam change.

## Task 1: Baseline Ledger PR

**Seams:** none. This is planning, GitHub state capture, and baseline evidence only.

**Files:**
- Create: `docs/hpr-pr-resolution-ledger-2026-06-05.md`
- Create: `docs/evidence/2026-06-05/hpr-pr-live-state/open-prs.json`
- Create: `docs/evidence/2026-06-05/hpr-pr-live-state/open-issues.json`
- Create: `docs/evidence/2026-06-05/hpr-pr-live-state/pr-NUMBER.json` where `NUMBER` is the actual PR number.
- Create: `docs/evidence/2026-06-05/hpr-pr-live-state/pr-NUMBER-review-threads.json` where `NUMBER` is the actual PR number.
- Create: `docs/evidence/2026-06-05/hpr-pr-live-state/pr-NUMBER-diff-stat.txt` where `NUMBER` is the actual PR number.
- Modify: `plan.md`

- [ ] **Step 1: Create baseline branch**

Run:

```powershell
$ErrorActionPreference = 'Stop'
if ((git status --short).Length -gt 0) { throw "Dirty worktree; commit or stash before creating baseline branch." }
git checkout main
git pull --ff-only
git checkout -b codex/hpr-ledger-baseline-2026-06-05
```

Expected: new branch from current `main`.

- [ ] **Step 2: Capture live GitHub state**

Run:

```powershell
New-Item -ItemType Directory -Force docs/evidence/2026-06-05/hpr-pr-live-state
$openPrJson = gh pr list --state open --limit 200 --json number,title,headRefName,baseRefName,mergeStateStatus,isDraft,updatedAt,url
if ($LASTEXITCODE -ne 0) { throw "gh pr list failed" }
$openPrJson | ConvertFrom-Json | Out-Null
$openPrJson | Set-Content -Encoding utf8 docs/evidence/2026-06-05/hpr-pr-live-state/open-prs.json

$openIssueJson = gh issue list --state open --limit 200 --json number,title,url
if ($LASTEXITCODE -ne 0) { throw "gh issue list failed" }
$openIssueJson | ConvertFrom-Json | Out-Null
$openIssueJson | Set-Content -Encoding utf8 docs/evidence/2026-06-05/hpr-pr-live-state/open-issues.json
```

Expected: JSON files exist and include the current open PR/issue set.

- [ ] **Step 3: Populate per-PR state files**

For each open PR number, run:

```powershell
$openPrs = Get-Content docs/evidence/2026-06-05/hpr-pr-live-state/open-prs.json -Raw | ConvertFrom-Json
git fetch origin '+refs/pull/*/head:refs/remotes/origin/pr/*'
foreach ($prSummary in $openPrs) {
  $number = $prSummary.number
  $detailPath = "docs/evidence/2026-06-05/hpr-pr-live-state/pr-$number.json"
  $threadPath = "docs/evidence/2026-06-05/hpr-pr-live-state/pr-$number-review-threads.json"
  $statPath = "docs/evidence/2026-06-05/hpr-pr-live-state/pr-$number-diff-stat.txt"

  $detail = gh pr view $number --json number,title,body,files,comments,reviews,reviewDecision,mergeStateStatus,baseRefName,headRefName,url
  if ($LASTEXITCODE -ne 0) { throw "gh pr view failed for PR #$number" }
  $detailObject = $detail | ConvertFrom-Json
  $detail | Set-Content -Encoding utf8 $detailPath

  $threads = gh api graphql -F owner=Phazzie -F name=meechiescoloringbook -F number=$number -f query='query($owner:String!,$name:String!,$number:Int!){ repository(owner:$owner,name:$name){ pullRequest(number:$number){ reviewThreads(first:100){ pageInfo { hasNextPage endCursor } nodes { isResolved path line comments(first:30){ pageInfo { hasNextPage endCursor } nodes { author { login } body url createdAt } } } } } } } }'
  if ($LASTEXITCODE -ne 0) { throw "review thread query failed for PR #$number" }
  $threadObject = $threads | ConvertFrom-Json
  if ($threadObject.data.repository.pullRequest.reviewThreads.pageInfo.hasNextPage) { throw "PR #$number review threads need pagination" }
  $threads | Set-Content -Encoding utf8 $threadPath

  $baseRef = "origin/$($detailObject.baseRefName)"
  git show-ref --verify --quiet "refs/remotes/origin/pr/$number"
  if ($LASTEXITCODE -ne 0) { throw "Missing origin/pr/$number" }
  git diff "$baseRef...origin/pr/$number" --stat | Set-Content -Encoding utf8 $statPath
}
```

Expected: one PR detail file and one review-thread file per open PR.

- [ ] **Step 4: Create the ledger**

Write `docs/hpr-pr-resolution-ledger-2026-06-05.md` with the required header, a table row for every open PR, a row for every open non-PR issue, and a "Baseline validation" section.

- [ ] **Step 5: Run baseline validation**

Run:

```powershell
Invoke-HprCommand 'docs/evidence/2026-06-05/hpr-baseline-npm-ci.txt' { npm.cmd ci }
Invoke-HprCommand 'docs/evidence/2026-06-05/hpr-baseline-check.txt' { npm.cmd run check }
Invoke-HprCommand 'docs/evidence/2026-06-05/hpr-baseline-lint.txt' { npm.cmd run lint }
Invoke-HprCommand 'docs/evidence/2026-06-05/hpr-baseline-test.txt' { npm.cmd test }
Invoke-HprCommand 'docs/evidence/2026-06-05/hpr-baseline-build.txt' { npm.cmd run build }
```

Expected: all pass, or failures are recorded in the baseline section with links to the exact evidence files.

- [ ] **Step 6: Open baseline ledger PR**

Run:

```powershell
git add docs/hpr-pr-resolution-ledger-2026-06-05.md docs/evidence/2026-06-05/hpr-pr-live-state plan.md
git commit -m "docs: add autonomous HPR baseline ledger"
gh pr create --title "docs: add autonomous HPR baseline ledger" --body "Adds live PR state capture, baseline validation, and the Handoff PR Resolution ledger for the PR drain work."
```

Expected: PR 1 contains only planning, live-state JSON, and baseline evidence.

## Task 2: HTTP Error Policy PR

**Seams:** `ProviderAdapterSeam`, `ChatInterpretationSeam`, `MeechieToolSeam`, `MeechieStudioTextSeam`, `ImageGenerationSeam`.

**Files:**
- Modify: `src/lib/core/http-client.ts`
- Modify: `tests/unit/http-client.test.ts`
- Modify: `tests/unit/api-chat-interpretation.test.ts`
- Modify: `tests/unit/api-tools.test.ts`
- Modify: `docs/hpr-pr-resolution-ledger-2026-06-05.md`
- Modify: `DECISIONS.md`

- [ ] **Step 1: Write tests that lock the policy**

Add tests proving:

- success JSON returns parsed data
- `204` and `205` return `undefined`
- non-2xx contract JSON returns the parsed `{ ok: false, error: ... }` payload
- non-2xx non-JSON throws with URL, status, status text, and parse reason
- ok invalid JSON throws with URL, status, status text, and parse reason

Run:

```powershell
npm.cmd test -- tests/unit/http-client.test.ts --pool=forks --maxWorkers=1
```

Expected before implementation: failing assertions for missing `204` or structured non-2xx behavior if current main does not already satisfy them.

- [ ] **Step 2: Implement the policy**

`postJson` must send JSON as before, read body text once, return parsed JSON regardless of `response.ok`, return `undefined` for empty successful bodies and `204`/`205`, and throw rich parse/empty-body errors for invalid or empty failure bodies.

- [ ] **Step 3: Validate**

Run:

```powershell
npm.cmd test -- tests/unit/http-client.test.ts tests/unit/api-chat-interpretation.test.ts tests/unit/api-tools.test.ts --pool=forks --maxWorkers=1
npm.cmd run check
npm.cmd run lint
npm.cmd test
npm.cmd run build
```

Expected: all pass.

- [ ] **Step 4: Ledger and old PR disposition**

Update the ledger rows for old PRs whose only useful content was `postJson` or structured-error behavior. Do not close a PR until the replacement work is merged to `main`, or until the ledger records that no salvage is needed and a closure comment has been posted.

## Task 3: Generate Flow Through ImageGenerationSeam PR

**Seams:** `ImageGenerationSeam`, `SpecValidationSeam`, `OutputPackagingSeam`, `ProviderAdapterSeam`.

**Files:**
- Modify: `src/lib/core/generate-pipeline.ts`
- Modify: `src/routes/api/generate/+server.ts`
- Modify: `tests/unit/api-generate.test.ts`
- Modify: `tests/unit/image-generation-pipeline.test.ts`
- Modify: `contracts/image-generation.contract.ts`
- Modify: `tests/contract/image-generation.test.ts`
- Modify: `docs/hpr-pr-resolution-ledger-2026-06-05.md`
- Modify: `DECISIONS.md`

- [ ] **Step 1: Write generate-pipeline seam tests**

Tests must prove seam success, seam typed failure, and seam thrown exception. Thrown unexpected provider exceptions must become contract-shaped `{ ok: false, error: ... }` responses with status semantics recorded in the assertion.

- [ ] **Step 2: Implement direct seam routing**

`runGeneratePipeline` must consume `ImageGenerationSeam` through injected dependencies and avoid raw sibling HTTP calls. It must preserve typed seam errors and classify unexpected thrown timeout/abort errors as timeout responses where the contract supports it.

- [ ] **Step 3: Validate**

Run:

```powershell
npm.cmd test -- tests/unit/api-generate.test.ts tests/unit/image-generation-pipeline.test.ts tests/contract/image-generation.test.ts --pool=forks --maxWorkers=1
npm.cmd run rewind -- --seam ImageGenerationSeam
npm.cmd run check
npm.cmd run lint
npm.cmd test
npm.cmd run build
npm.cmd run verify
```

Expected: all pass, with ImageGenerationSeam evidence updated if seam artifacts changed.

## Task 4: SafetyPolicySeam Generate Gate PR

**Seams:** `SafetyPolicySeam`, `ImageGenerationSeam`, `SpecValidationSeam`, `ProviderAdapterSeam`.

**Files:**
- Modify: `src/lib/core/generate-pipeline.ts`
- Modify: `src/lib/seams/safety-policy-seam/contract.ts`
- Modify: `src/lib/seams/safety-policy-seam/fixtures.ts`
- Modify: `src/lib/seams/safety-policy-seam/mock.ts`
- Modify: `src/lib/seams/safety-policy-seam/test.ts`
- Modify: `tests/unit/api-generate.test.ts`
- Modify: `tests/unit/pipeline-edge-cases.test.ts`
- Modify: `docs/hpr-pr-resolution-ledger-2026-06-05.md`
- Modify: `DECISIONS.md`

- [ ] **Step 1: Inspect PR #115 review state**

Use PR #115 as the lead idea, but do not merge it wholesale. Verify whether its content-safety gate still applies after Task 3 routes generation through `ImageGenerationSeam`.

- [ ] **Step 2: Write safety gate tests**

Tests must prove blocked content returns a contract-shaped error before image generation, allowed content still reaches image generation, and the safety mock loads fixture scenarios without invented data.

- [ ] **Step 3: Implement minimal safety gate**

Wire `SafetyPolicySeam` into `runGeneratePipeline` through injected dependencies. Preserve structured error payloads and avoid direct provider or filesystem I/O in core logic.

- [ ] **Step 4: Validate**

Run:

```powershell
npm.cmd test -- src/lib/seams/safety-policy-seam/test.ts tests/unit/api-generate.test.ts tests/unit/pipeline-edge-cases.test.ts --pool=forks --maxWorkers=1
npm.cmd run rewind -- --seam SafetyPolicySeam
npm.cmd run check
npm.cmd run lint
npm.cmd test
npm.cmd run build
npm.cmd run verify
```

Expected: all pass, with SafetyPolicySeam evidence recorded if seam artifacts changed.

## Task 5: Timeout And Abort Policy PR

**Seams:** `ImageGenerationSeam`, `WigTryOnSeam`, `ProviderAdapterSeam`, `MeechieStudioTextSeam`.

**Files:**
- Modify: `src/lib/core/http-resilience.ts`
- Modify: `tests/unit/http-resilience.test.ts`
- Modify: `src/lib/core/image-generation-pipeline.ts`
- Modify: `tests/unit/image-generation-pipeline.test.ts`
- Modify: `src/lib/adapters/image-generation.adapter.ts`
- Modify: `src/lib/adapters/image-generation-seam/index.ts`
- Modify: `src/lib/adapters/wig-try-on-seam/index.ts`
- Modify: `src/lib/core/meechie-studio-text-pipeline.ts`
- Modify: `docs/hpr-pr-resolution-ledger-2026-06-05.md`
- Modify: `DECISIONS.md`

- [ ] **Step 1: Write timeout and abort tests**

Tests must prove caller abort is not retried, timeout abort is classified distinctly from caller cancel, body read timeouts are not converted into invalid JSON, retry parameter validation rejects `NaN` and `Infinity`, `maxAttempts` must be an integer greater than or equal to 1, backoff is capped, HTTP-date `Retry-After` works, and discarded retry responses are canceled or drained.

- [ ] **Step 2: Implement conservative retry behavior**

Do not automatically retry billable non-idempotent image-generation POSTs unless an idempotency key is present and sent. Timeout-only protection is acceptable for billable calls. If retry logic remains for non-billable calls, cap all delays and preserve caller abort signals.

- [ ] **Step 3: Validate**

Run:

```powershell
npm.cmd test -- tests/unit/http-resilience.test.ts tests/unit/image-generation-pipeline.test.ts --pool=forks --maxWorkers=1
npm.cmd run check
npm.cmd run lint
npm.cmd test
npm.cmd run build
npm.cmd run verify
```

Expected: all pass or environment failures are isolated and ledgered.

## Task 6: MeechieStudioTextPipeline Recovery PR

**Seams:** `MeechieStudioTextSeam`, `ProviderAdapterSeam`.

**Files:**
- Modify: `src/lib/core/meechie-studio-text-pipeline.ts`
- Modify: `tests/unit/meechie-studio-text-pipeline.test.ts`
- Modify: `contracts/meechie-studio-text.contract.ts`
- Modify: `src/routes/api/meechie-studio-text/+server.ts`
- Modify: `docs/hpr-pr-resolution-ledger-2026-06-05.md`
- Modify: `DECISIONS.md`

- [ ] **Step 1: Write recovery tests**

Tests must cover JSON syntax retry, schema validation retry, valid JSON primitive schema failure, provider `429`, provider timeout, provider generic network failure, provider error during retry, and API-key-missing behavior in development and production modes.

- [ ] **Step 2: Implement recovery**

Use an explicit parse outcome sentinel so `false`, `0`, `""`, and `null` are parse successes that can fail schema validation. Keep retry prompt text synchronized with `STUDIO_TEXT_RESPONSE_FORMAT.required`. Inject runtime mode rather than reading `process.env` directly in core logic.

- [ ] **Step 3: Validate**

Run:

```powershell
npm.cmd test -- tests/unit/meechie-studio-text-pipeline.test.ts tests/unit/api-meechie-studio-text-endpoint.test.ts --pool=forks --maxWorkers=1
npm.cmd run check
npm.cmd run lint
npm.cmd test
npm.cmd run build
npm.cmd run verify
```

Expected: all pass.

## Task 7: Studio State Extraction And UI Hardening PR

**Seams:** `WigCatalogSeam`, `WigTryOnSeam`, `CreationStoreSeam`, `SpecValidationSeam`, `MeechieToolSeam`, `ImageGenerationSeam`.

**Files:**
- Modify: `src/lib/components/studio/StudioInputPanel.svelte`
- Modify: `src/lib/components/studio/WigTryOnStudio.svelte`
- Modify: `src/lib/components/SelfieUpload.svelte`
- Modify: `src/lib/components/WigCarousel.svelte`
- Modify: `src/lib/components/MeechieTools.svelte`
- Modify: `src/routes/+page.svelte`
- Create or modify: `src/routes/studio-state.svelte.ts`
- Modify: `tests/unit/meechie-studio.test.ts`
- Modify: `tests/unit/api-wig-try-on.test.ts`
- Modify: `tests/e2e/smoke.spec.ts`
- Modify: `docs/hpr-pr-resolution-ledger-2026-06-05.md`

- [ ] **Step 1: Inspect PR #124 and #125 state extraction**

Use #124 and #125 as the lead evidence for extracting `src/routes/studio-state.svelte.ts`, but only port the extraction if behavior parity is provable with tests and `npm.cmd run check`. If extraction is too risky, record the useful smaller fixes and defer the broad extraction to the final audit.

- [ ] **Step 2: Write or update UI behavior tests**

Tests or Svelte check coverage must prove dedication input saves the latest character, clearing dedication stores `undefined`, same-file upload can be retried, upload errors clear stale preview, malformed base64 is rejected visibly, wig catalog data is schema-validated, and focus styling remains keyboard-visible.

- [ ] **Step 3: Implement hardening**

Use event payloads for dedication updates, extract `DRAFT_SAVE_DEBOUNCE_MS = 300`, clear stale previews on upload failure, reset file input value after handling, and validate catalog data with `wigCatalogSchema`.

- [ ] **Step 4: Validate**

Run:

```powershell
npm.cmd test -- tests/unit/meechie-studio.test.ts tests/unit/api-wig-try-on.test.ts --pool=forks --maxWorkers=1
npm.cmd run check
npm.cmd run lint
npm.cmd test
npm.cmd run build
```

If Playwright is available, also run:

```powershell
npx.cmd playwright test
```

Expected: all supported commands pass.

## Task 8: Fixture And Mock Discipline PR

**Seams:** `PromptCompilerSeam`, `GalleryStoreSeam`, `SafetyPolicySeam`, `TelemetrySeam`.

**Files:**
- Modify: `src/lib/seams/prompt-compiler-seam/mock.ts`
- Modify: `src/lib/seams/prompt-compiler-seam/fixtures.ts`
- Modify: `src/lib/seams/prompt-compiler-seam/test.ts`
- Modify: `src/lib/seams/gallery-store-seam/mock.ts`
- Modify: `src/lib/seams/gallery-store-seam/fixtures.ts`
- Modify: `src/lib/seams/gallery-store-seam/test.ts`
- Modify: `design.md`
- Modify: `docs/hpr-pr-resolution-ledger-2026-06-05.md`
- Modify: `DECISIONS.md`

- [ ] **Step 1: Write mutation-leak tests**

Tests must prove mocks return fresh clones, `GalleryStoreSeam` clones on save and list, list order is deterministic, limit is enforced, and fault fixtures are consumed as `unknown` by validators.

- [ ] **Step 2: Implement mock and fixture corrections**

Use `structuredClone` for returned fixture data. Do not double-cast fault fixtures to valid contract types. Header comments must match behavior.

- [ ] **Step 3: Decide design doc handling**

If `design.md` remains, verify it has the Purpose/Why/Info flow header, typography matches loaded fonts, token prose and machine-readable values agree, and the Google Fonts URL has `family`, not `vamily`. If the design doc is not needed for current app behavior, record a backlog note in the ledger instead of expanding this PR.

- [ ] **Step 4: Validate**

Run:

```powershell
npm.cmd test -- src/lib/seams/prompt-compiler-seam/test.ts src/lib/seams/gallery-store-seam/test.ts --pool=forks --maxWorkers=1
npm.cmd run check
npm.cmd run lint
npm.cmd test
npm.cmd run build
npm.cmd run verify
```

Expected: all pass.

## Task 9: Lint, E2E, And Old Test Audit PR

**Seams:** `ImageGenerationSeam`, `MeechieToolSeam`, `CreationStoreSeam`, `SessionSeam`.

**Files:**
- Modify: `eslint.config.js`
- Create: `.prettierignore`
- Modify: `tests/e2e/smoke.spec.ts`
- Modify: `docs/hpr-pr-resolution-ledger-2026-06-05.md`

Generated-test files from PR #79 are not pre-approved here. If the audit finds a specific test worth keeping, update this plan and the ledger with the exact file path before editing it.

- [ ] **Step 1: Audit lint config**

Keep unused-variable checking enabled. Scope browser globals to Svelte/browser files and Node globals to scripts/server tests. Allow underscore-prefixed intentionally unused args and optional catch binding `catch {}`.

- [ ] **Step 2: Stabilize E2E tests**

Use deterministic selectors or test IDs and concrete UI states. Do not use arbitrary waits. If clock control is needed and Playwright supports it in this environment, use Playwright clock APIs.

- [ ] **Step 3: Audit generated tests**

For each generated test PR, keep only tests that compile, assert current behavior, and are not duplicates. Record skipped tests and reasons in the ledger.

- [ ] **Step 4: Validate**

Run:

```powershell
npm.cmd run check
npm.cmd run lint
npm.cmd test
npm.cmd run build
npx.cmd playwright test
```

If Playwright browsers are unavailable, record the browser install blocker and run the strongest available non-browser validation.

## Task 10: Dependency Bump PR

**Seams:** none unless dependency behavior changes a seam test result.

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `docs/hpr-pr-resolution-ledger-2026-06-05.md`

- [ ] **Step 1: Refresh dependency PR state**

Inspect the dependency PR after the other workpacks land. Before closing it as stale, check whether it contains a security advisory or vulnerability fix, inspect its current CI status, and confirm whether Dependabot has opened a superseding PR. If there is no superseding PR and no explicit user approval, leave it open with a comment that dependency handling is blocked.

- [ ] **Step 2: Apply only if clean**

If applying the bump, run:

```powershell
npm.cmd ci
npm.cmd run check
npm.cmd run lint
npm.cmd test
npm.cmd run build
npm.cmd run verify
```

Expected: all pass.

## Task 11: Broad PR Salvage Audit PR

**Seams:** depends on live PR diffs; update this plan before touching implementation files.

**Files:**
- Modify: `docs/hpr-pr-resolution-ledger-2026-06-05.md`
- Create: `docs/hpr-broad-pr-salvage-audit-2026-06-05.md`
- Modify implementation files only if a salvaged idea is specific, tested, and not already covered by Tasks 2-10.

- [ ] **Step 1: Build the broad-audit list**

At minimum inspect PRs initially classified as too broad or too risky, including old large seam migrations, broad formatting churn, generated tests, old design docs, and dependency churn. Use live GitHub state, not the original May 30 list.

- [ ] **Step 2: Inspect diffs before closure**

For each broad PR, use its captured `baseRefName` from the matching `docs/evidence/2026-06-05/hpr-pr-live-state/pr-NUMBER.json` file, then run:

```powershell
$detail = Get-Content docs/evidence/2026-06-05/hpr-pr-live-state/pr-73.json -Raw | ConvertFrom-Json
$baseRef = "origin/$($detail.baseRefName)"
git diff "$baseRef...origin/pr/$($detail.number)" --stat
git diff "$baseRef...origin/pr/$($detail.number)" -- docs/seams.md
```

Expected: ledger records specific salvaged or skipped content for each PR. The snippet uses PR #73 and `docs/seams.md` as an example; for each audited PR, use that PR's actual captured number, base branch, and relevant file paths from its file list.

- [ ] **Step 3: Salvage only focused value**

If a useful test, doc sentence, or code idea remains, port it to a new focused branch or the current audit branch with targeted tests. Do not merge broad PR branches wholesale.

- [ ] **Step 4: Close or comment**

For each remaining old PR, comment with:

```md
Closing as superseded by the Handoff PR Resolution cleanup.

Salvaged:
- <specific item> -> <file or replacement PR>

Not salvaged:
- <specific item> -> <reason>

Validation:
- Replacement PR: use the exact replacement PR URL from the ledger row
- Ledger row: docs/hpr-pr-resolution-ledger-2026-06-05.md
- npm run check evidence: use the exact check path from the ledger row
- npm run lint evidence: use the exact lint path from the ledger row
- npm test evidence: use the exact test path from the ledger row
- npm run build evidence: use the exact build path from the ledger row
- GitHub checks evidence: use the exact GitHub checks path from the ledger row

Tracked in docs/hpr-pr-resolution-ledger-2026-06-05.md.
```

If permissions prevent closure, leave the comment and set final state to `closure requested`.

## Final Completion Gate

Before saying the backlog is drained, run:

```powershell
Invoke-HprCommand 'docs/evidence/2026-06-05/hpr-final-open-prs.json' { gh pr list --state open --limit 200 --json number,title,url }
Invoke-HprCommand 'docs/evidence/2026-06-05/hpr-final-open-issues.json' { gh issue list --state open --limit 200 --json number,title,url }
Invoke-HprCommand 'docs/evidence/2026-06-05/hpr-final-check.txt' { npm.cmd run check }
Invoke-HprCommand 'docs/evidence/2026-06-05/hpr-final-lint.txt' { npm.cmd run lint }
Invoke-HprCommand 'docs/evidence/2026-06-05/hpr-final-test.txt' { npm.cmd test }
Invoke-HprCommand 'docs/evidence/2026-06-05/hpr-final-build.txt' { npm.cmd run build }
Invoke-HprCommand 'docs/evidence/2026-06-05/hpr-final-verify.txt' { npm.cmd run verify }
Invoke-HprCommand 'docs/evidence/2026-06-05/hpr-final-diff-check.txt' { git diff --check }
Invoke-HprCommand 'docs/evidence/2026-06-05/hpr-final-git-status.txt' { git status --short --branch }
```

If Playwright is available:

```powershell
Invoke-HprCommand 'docs/evidence/2026-06-05/hpr-final-playwright.txt' { npx.cmd playwright test }
```

Then run the hard ledger coverage assertion:

```powershell
$openPrs = (Get-Content docs/evidence/2026-06-05/hpr-pr-live-state/open-prs.json -Raw | ConvertFrom-Json).number | Sort-Object
$ledger = Get-Content docs/hpr-pr-resolution-ledger-2026-06-05.md -Raw
foreach ($number in $openPrs) {
  if ($ledger -notmatch "\| #?$number \|") { throw "Missing ledger row for PR #$number" }
  if ($ledger -notmatch "#$number[^\n]*(open - pending replacement|open - blocked|closed - superseded|merged|closure requested)") { throw "Missing final state for PR #$number" }
  if ($ledger -notmatch "#$number[^\n]*(docs/evidence/2026-06-05/|https://github.com/Phazzie/meechiescoloringbook/pull/)") { throw "Missing evidence or replacement link for PR #$number" }
}
```

Final completion is blocked if any baseline PR lacks a final ledger state, replacement PR link or blocker, validation evidence path, and closure/comment URL. The final answer must include the replacement PR links, the ledger path, remaining open PRs with blocker reasons, validation command results, and a direct statement about whether any broad PRs were skipped after audit.

## Plan Self-Review

- Spec coverage: The plan covers live refresh, smaller replacement PRs, tests, self-critique, broad PR salvage audit, GitHub comments/closure, and final validation.
- Placeholder scan: No workpack is allowed to touch a file outside its listed paths until this plan and the ledger are updated first.
- Type consistency: Seam names match `docs/seams.md` as of 2026-06-05.
- Technical debt check: The plan favors current-main implementation, typed tests, structured error preservation, conservative provider retry behavior, cloned fixtures, and scoped lint changes over broad branch merges.
