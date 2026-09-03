<!--
Purpose: Explain the project, its tech stack, and how to run it locally.
Why: Keep Seam-Driven Development conventions and dev setup visible to contributors.
Info flow: Intro -> features -> stack -> setup -> env vars -> scripts -> architecture -> testing -> deployment.
-->

# Meechie's Coloring Book 🎨

Meechie's Coloring Book is an AI-powered adult coloring book app. Tell Meechie what your man/friend/coworker did, and she turns her verdict, quote, and receipts into a printable, glamorous coloring page — with her signature savage, no-therapy-speak wisdom — that you can print, color, keep, or send to whoever needs to see it. Powered by xAI (Grok) under the hood.

Live app: **https://meechiescoloringbook.vercel.app**

---

## ✨ Features

- AI-powered coloring book image generation via xAI (Grok)
- Custom text and story generation with Meechie's unique voice
- PDF export of coloring pages — print and color right away
- Deployed on Vercel at https://meechiescoloringbook.vercel.app
- Android-friendly PWA with manifest and offline-safe assets

---

## 🛠 Tech Stack

| Layer | Technology |
|-------|------------|
| **Framework** | SvelteKit 2 with Svelte 5 runes |
| **AI** | xAI (Grok) for text and image generation |
| **Testing** | Vitest 4 (unit/integration) + Playwright (E2E) |
| **Deployment** | Vercel with `@sveltejs/adapter-vercel` (Node 22) |
| **Validation** | Zod schema validation at all seam boundaries |
| **Architecture** | Seam-Driven Development (SDD) |
| **PDF** | pdf-lib for coloring page export |

---

## 🚀 Getting Started

**Prerequisites:** Node.js 22+, npm, xAI API key

**Setup:**

```bash
git clone https://github.com/Phazzie/meechiescoloringbook.git
cd meechiescoloringbook
npm install
cp .env.example .env
# Fill in your API keys in .env
npm run dev
```

The app will be available at `http://localhost:5173`.

**Install git hooks (recommended):**

```bash
npm run hooks:install
```

Run this once after cloning to enable local pre-commit and pre-push verification.

---

## 🔐 Environment Variables

Copy `.env.example` to `.env` and fill in your values.

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `XAI_API_KEY` | Yes | — | Your xAI API key for Grok access |
| `XAI_BASE_URL` | No | `https://api.x.ai` | xAI API base URL |
| `XAI_IMAGE_ENDPOINT_PATH` | No | `/v1/images/generations` | API path for image generation requests |
| `DEFAULT_IMAGE_SIZE` | No | `1024x1024` | Parsed into `AppConfig` but not currently wired into generation — the image pipeline uses its own hard-coded `1024x1024` and the xAI adapter never sends a `size` field. Setting this has no effect yet |
| `FEATURE_INTEGRATION_TESTS` | No | `false` | Set to `true` to enable live API integration tests |
| `UPSTASH_REDIS_REST_URL` | No | — | Durable rate-limit store. Set together with the two vars below, or leave all three blank — see note |
| `UPSTASH_REDIS_REST_TOKEN` | No | — | Durable rate-limit store credential; set together with `UPSTASH_REDIS_REST_URL` and `RATE_LIMIT_IDENTITY_SECRET` |
| `RATE_LIMIT_IDENTITY_SECRET` | No | — | HMAC secret for pseudonymous client identifiers; set together with the two vars above |
| `RATE_LIMIT_OPERATION_TIMEOUT_MS` | No | `1500` | Timeout for a durable rate-limit store operation |
| `GEMINI_API_KEY` / `GEMINI_BASE_URL` | No | — | Legacy/unused. Wig try-on now runs on xAI; safe to delete |

> **Rate limiting:** set all three of `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`, and `RATE_LIMIT_IDENTITY_SECRET`, or leave all three blank. Leaving all three blank falls back to a degraded per-instance in-process limiter (still enforced, just not shared across serverless instances) — there is no way to disable rate limiting entirely. Setting only some of the three fails every AI route closed with 503, on purpose: a half-configured limiter is treated as a misconfiguration, not a reason to silently degrade.

**Model ids are not environment variables.** They are pinned in `src/lib/core/models.js`
(`TEXT_MODEL`, `IMAGE_MODEL`). A model id is not a secret and does not vary per environment,
so it belongs in a reviewed diff rather than a dashboard. `XAI_TEXT_MODEL` and
`XAI_IMAGE_MODEL` used to be read here; a stale value left in a deployment silently
overrode the code and pinned production to a model xAI had retired, which returned HTTP 400
on every text call. Any such variable still set in a deployment is now inert.

To change a model, edit `src/lib/core/models.js` and open a pull request.

> **Note:** Integration tests require both `FEATURE_INTEGRATION_TESTS=true` and a valid `XAI_API_KEY`.

---

## 📦 Available Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Build for production |
| `npm run preview` | Preview production build |
| `npm run test` | Run unit tests (Vitest) |
| `npm run test:e2e` | Run Playwright E2E tests |
| `npm run test:integration` | Run integration tests against real APIs (requires `FEATURE_INTEGRATION_TESTS=true`) |
| `npm run lint` | Run ESLint |
| `npm run format` | Format files with Prettier |
| `npm run format:check` | Check formatting (CI) |
| `npm run check` | SvelteKit type check |
| `npm run verify` | Full verify pipeline (audit gate, chamber lock, verify runner [check + test], shaolin lint, assumption alarm, seam ledger, clan chain, proof tape) |
| `npm run hooks:install` | Install local git pre-commit/pre-push hooks |

---

## 🏗 Architecture

This project uses **Seam-Driven Development (SDD)** — every external integration point is isolated behind a "seam" with a defined contract, deterministic mock, and real adapter. This prevents integration drift and keeps core logic testable without live API calls.

Each seam consists of:
- `contract.ts` — TypeScript types and Zod schemas
- `fixtures.ts` — static test data captured from real API responses
- `mock.ts` — deterministic test doubles (load fixtures by scenario, no invented data)
- `adapter.ts` — real implementation behind the seam

**Key directories:**

```
src/
  routes/         SvelteKit pages and API routes
  lib/
    core/         Business logic pipelines (no I/O)
    seams/        Seam contracts, mocks, and fixtures
    adapters/     Real seam implementations
contracts/        Shared cross-seam types
fixtures/         Captured API response fixtures
tests/            Unit, contract, and integration tests
scripts/          SDD automation tools (verify, chamber-lock, etc.)
docs/
  seams.md        Inventory of all seams and their owners
  evidence/       Dated evidence output from verify runs
```

See [AGENTS.md](./AGENTS.md) for the full Seam-Driven Development workflow and governance rules.

---

## 🧪 Testing

```bash
npm run test          # Unit tests (Vitest)
npm run test:e2e      # E2E tests (Playwright)
npm run test:integration  # Integration tests (requires FEATURE_INTEGRATION_TESTS=true)
```

Integration tests against real APIs are gated behind `FEATURE_INTEGRATION_TESTS=true` in `.env`. All other tests use deterministic mocks backed by captured fixtures and run without any API keys.

---

## 🚢 Deployment

Automatic Vercel deployment triggers on every push to `main`.

**Production:** https://meechiescoloringbook.vercel.app

The app uses `@sveltejs/adapter-vercel` targeting Node 22. No manual deploy steps are needed — merge to `main` and Vercel handles the rest.

---

## 🤝 Contributing

Follow the [SDD conventions in AGENTS.md](./AGENTS.md). Before submitting a PR:

1. Run `npm run verify` — must pass with no errors
2. Any seam change requires a Cipher Gate entry in `DECISIONS.md`
3. Every new file needs a Purpose/Why/Info flow header comment
4. Fixtures must be fresh (≤ 7 days) or a waiver recorded in `DECISIONS.md`

For seam-scoped verification without running the full pipeline:

```bash
npm run rewind -- --seam <SeamName>
```
