<!-- 
Purpose: Describes the hpr-pr-live-state evidence snapshot captured on 2026-06-05, documenting
the CI-generated inventory of open issues, open PRs, per-PR review threads, and diff-stats
from the GitHub API at that point in time.
Why: Provides a dated baseline for the SDD shaolin-lint freshness gate and manual audit tooling
so regressions in review-thread coverage can be detected across sessions.
Data flow: GitHub API → CI collector (verify-runner.mjs) → these evidence files → shaolin-lint
freshness gate → manual audit tooling and HPR review dashboards.
Adjacent-doc note: This README satisfies the repository "*.json adjacent documentation" requirement
for all machine-generated pr-*.json, pr-*-review-threads.json, and pr-*-diff-stat.txt files in
this directory. Each file's purpose follows the same pattern documented below.
-->
# hpr-pr-live-state evidence

Snapshot of GitHub live state captured by `verify-runner.mjs` on 2026-06-05.

## File inventory

| Pattern | Description |
|---------|-------------|
| `open-issues.json` | Array of open issues at snapshot time (GitHub Issues API). |
| `open-prs.json` | Array of open pull requests at snapshot time (GitHub PRs API). |
| `pr-<N>.json` | Full PR object for PR #N (GitHub PRs API). |
| `pr-<N>-review-threads.json` | Review threads for PR #N (GitHub GraphQL reviewThreads). |
| `pr-<N>-diff-stat.txt` | Diff-stat summary (additions/deletions/files changed) for PR #N. |

## Data flow

```text
GitHub API → CI collector → these files → shaolin-lint freshness gate
                                         → manual audit tooling
```

## Adjacent documentation declaration

All `.json` files in this directory are machine-generated evidence artifacts produced
by the CI evidence collector. This README serves as the required adjacent documentation
for every such file. Individual files do not contain inline comments because the JSON
format does not support them. The schema and field semantics for each file type are
described in the table above and in `docs/seams.md`.
