# hpr-pr-live-state evidence

**Purpose:** Snapshot of live PR and issue state captured on 2026-06-05 as part of the HPR (High-Priority Review) baseline ledger.

**Generator:** CI evidence collector (`scripts/verify-runner.mjs`) querying the GitHub API. Each file is written once at collection time and never mutated.

**Consumers:** `scripts/shaolin-lint.mjs` (evidence freshness checks), manual audit, and any tooling that reads `docs/evidence/` to verify seam/PR state at a point in time.

## File inventory

| Pattern | Description |
|---------|-------------|
| `open-issues.json` | All open issues at collection time |
| `open-prs.json` | All open pull requests at collection time |
| `pr-<N>.json` | Full PR metadata for PR #N |
| `pr-<N>-review-threads.json` | Review thread snapshots for PR #N (`data.repository.pullRequest.reviewThreads`) |
| `pr-<N>-diff-stat.txt` | Diff-stat summary (`git diff --stat`) for PR #N |

## Data flow

```
GitHub API → CI collector → these files → shaolin-lint freshness gate
                                         → manual audit tooling
```

All JSON files contain a single top-level object or array; no streaming or pagination artifacts are present. The `reviewThreads` nodes reflect resolution state at collection time and may be stale relative to current PR state.
