<!--
Purpose: Documents the 2026-06-05 HPR live-state evidence snapshot, describing the CI-generated
inventory of open issues, PRs, review threads, and diff-stats captured from the GitHub API.
Why: Provides a single source of truth for understanding the snapshot's scope, file patterns,
and consumption by shaolin-lint and audit tooling.
Data flow: GitHub API → CI collector (verify-runner.mjs) → evidence files → lint gates & manual audits.
-->

# hpr-pr-live-state evidence

Snapshot of open PRs and issues captured on 2026-06-05 by the HPR live-state CI step.

## File inventory

| Pattern | Contents |
|---------|----------|
| `open-prs.json` | List of all open PRs at snapshot time |
| `open-issues.json` | List of all open issues at snapshot time |
| `pr-N.json` | Full PR metadata for PR number N |
| `pr-N-review-threads.json` | Review thread details for PR number N |
| `pr-N-diff-stat.txt` | Diff statistics for PR number N |

## Data flow

```text
GitHub API → CI collector → these files → shaolin-lint freshness gate
                                         → manual audit tooling
```

## Note on machine-generated JSON files

All `*.json` files in this directory are machine-generated CI artifacts (emitted by
`verify-runner.mjs` via the GitHub API). They are exempt from the top-level comment
requirement that applies to hand-authored source files. This README serves as the
adjacent documentation satisfying that requirement for every `*.json` file in the directory.
