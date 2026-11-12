<!--
Purpose: Map this repo's GitHub Actions workflows onto the Depot CI that replaces them.
Why: GitHub Actions is billing-locked. The owner is moving CI to Cursor Origin, which runs
     GitHub-Actions-syntax YAML from `.depot/workflows/` on `depot-ubuntu-24.04` after the
     repo is detached from GitHub. The GitHub files stay in the tree until that detach.
Info flow: `.github/workflows/*` -> this map -> `.depot/workflows/ci.yml` and Depot secrets.
Invariants: Rosentic and the Playwright artifact upload are GitHub-only and are not ported.
     Vercel deploy settings are not a workflow in this repo and are not copied into Depot.
-->

# Origin CI

Depot is the CI host once this repository leaves GitHub. The workflow is
[`.depot/workflows/ci.yml`](../.depot/workflows/ci.yml). It uses the same checkout and
Node setup actions as GitHub Actions, on the `depot-ubuntu-24.04` runner, with Node taken
from [`.nvmrc`](../.nvmrc) (22.22.2). It runs on every pull request and on every push to `main`.

The GitHub workflow files under [`.github/workflows/`](../.github/workflows/) are unchanged.
They will not run while Actions billing is locked, and they stop being the CI host when the
repo is detached.

## Workflow map

| GitHub workflow                                                       | GitHub job | Depot job                        | What Depot runs                                                             |
| --------------------------------------------------------------------- | ---------- | -------------------------------- | --------------------------------------------------------------------------- |
| [`.github/workflows/verify.yml`](../.github/workflows/verify.yml)     | `verify`   | `verify`                         | `npm ci`, then `npm run verify`                                             |
| [`.github/workflows/verify.yml`](../.github/workflows/verify.yml)     | `e2e`      | `e2e`                            | `npm ci --ignore-scripts`, `npm run playwright:install`, `npm run test:e2e` |
| none                                                                  | none       | `ai-review` (pull requests only) | `npm ci`, then `node scripts/ai-review.mjs`                                 |
| [`.github/workflows/rosentic.yml`](../.github/workflows/rosentic.yml) | `rosentic` | not ported                       | Dropped. See below.                                                         |

`npm run verify` is the existing chain: `audit:gate`, chamber lock, `npm run check` plus
`npm test` (via `scripts/verify-runner.mjs`), shaolin lint, assumption alarm, seam ledger,
clan chain, and proof tape. The end-to-end job is Playwright against `playwright.config.ts`.
That config starts `npm run dev` itself. The Depot e2e job does not build the app or start a
preview server.

### Locked installs

The GitHub `verify` job runs `npm install`, which can resolve past the lockfile. Both Depot
installs use the lockfile:

- `verify` and `ai-review` run `npm ci`, so `prepare` (`svelte-kit sync`) still runs.
- `e2e` runs `npm ci --ignore-scripts`, matching the GitHub e2e job. That skips `prepare` and
  Playwright's own browser download. The dev server syncs SvelteKit, and
  `npm run playwright:install` (`playwright install --with-deps chromium`) installs the browser
  version pinned by the lockfile. The job does not call `npx`.

## AI review

On a pull request, `ai-review` checks out full history and runs
[`scripts/ai-review.mjs`](../scripts/ai-review.mjs).

- No `XAI_API_KEY`: the script prints `AI review skipped: XAI_API_KEY is not set` and exits 0.
- With a key: it diffs `origin/<base>...HEAD` (the base ref Depot passes as `GITHUB_BASE_REF`,
  otherwise `main`) and asks Grok. The model id is `TEXT_MODEL` in
  [`src/lib/core/models.js`](../src/lib/core/models.js), currently `grok-4.6`.
- It posts with `origin pr comment <PR_NUMBER> --body-file <file> --edit-last --create-if-none`.
  `--edit-last --create-if-none` updates this job's previous comment or adds one.
- No pull request number: the note is printed to the log as one line. Line breaks in the
  review become spaces, so the note cannot add extra log lines. The Origin comment keeps
  the original line breaks.
- The `origin` CLI is missing, or the comment command fails: the note is printed the same
  way and the process exits 0.
- xAI returns a non-OK status or an empty note: the process exits 1.

The script does not call the GitHub API. A `GITHUB_TOKEN` on the runner is ignored, so a
leftover token cannot send the review to a forge this workflow is leaving.

## GitHub-only, dropped

These stay in `.github/workflows/` until detach and are not in the Depot workflow.

| Piece                                                                 | Why it is GitHub-only                                                                                                                                                                                                           |
| --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`.github/workflows/rosentic.yml`](../.github/workflows/rosentic.yml) | `Rosentic/rosentic-action@v1` scans GitHub branches and writes GitHub checks and pull-request comments. It needs `secrets.GITHUB_TOKEN` and `pull-requests: write`. Depot has no equivalent.                                    |
| `actions/upload-artifact@v4` on the GitHub e2e job                    | On failure, GitHub uploads `playwright-report/` and `test-results/` for 7 days. That storage is GitHub's. Playwright still writes both directories on the Depot runner; the log has the list reporter. There is no upload step. |
| `npm install` on the GitHub verify job                                | Unlocked install. Depot uses `npm ci` instead.                                                                                                                                                                                  |

`GITHUB_TOKEN` is minted by GitHub Actions. It is not a secret to copy into Depot.

## Secrets to re-enter in Depot

| Secret                       | Used by Depot?        | Notes                                                                                                                                                                                                       |
| ---------------------------- | --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `XAI_API_KEY`                | Yes, `ai-review` only | Same key the app uses for xAI. It lives in Vercel and in local `.env` today. It is not referenced by either GitHub workflow. Enter it in Depot's secret store. Until then the review job skips and exits 0. |
| `UPSTASH_REDIS_REST_URL`     | No                    | Vercel runtime, for durable rate limits. Leave it on Vercel.                                                                                                                                                |
| `UPSTASH_REDIS_REST_TOKEN`   | No                    | Vercel runtime. Leave it on Vercel.                                                                                                                                                                         |
| `RATE_LIMIT_IDENTITY_SECRET` | No                    | Vercel runtime. Leave it on Vercel.                                                                                                                                                                         |
| `GEMINI_API_KEY`             | No                    | Legacy. The wig try-on path no longer calls Gemini.                                                                                                                                                         |
| `GITHUB_TOKEN`               | No                    | GitHub Actions injects this for Rosentic. Do not create it in Depot.                                                                                                                                        |

`verify` and `e2e` need no secrets. `npm run test:integration` is not part of either workflow.
It stays opt-in behind `FEATURE_INTEGRATION_TESTS`.

## Vercel

Nothing in `.github/workflows/` deploys this app. Production builds use
`@sveltejs/adapter-vercel` and [`vercel.json`](../vercel.json), triggered by Vercel's Git
connection. Detaching the repo from GitHub does not move that connection by itself. Reconnect
the Vercel project to the Origin remote when the detach happens. The runtime secrets above
stay in Vercel; copying them into Depot does not configure the deployment.
