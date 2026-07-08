// Purpose: Document RateLimitSeam probe strategy and its known limitation.
// Why: The adapter is an in-memory fixed-window counter with no external I/O, so there is
//      nothing to probe against a live system — but the limitation that in-memory state does
//      not survive serverless cold starts or replicate across concurrent instances is real and
//      must stay visible rather than being silently assumed away.
// Info flow: N/A — no automated probe; manual verification via repeated requests.
//
// Manual verification steps:
//   1. Run `npm run build && npm run preview` (or deploy to Vercel) to serve the production build.
//   2. Send more than `limit` POST requests to a guarded endpoint (e.g. `/api/image-generation`)
//      from the same client within `windowMs` and confirm the (limit + 1)th response is
//      `429` with a `Retry-After` header.
//   3. Wait past `windowMs` and confirm a subsequent request is allowed again.
//
// Known limitation (see DECISIONS.md Assumption entry, RateLimitSeam):
//   Vercel serverless functions are stateless per invocation/instance. This in-memory adapter
//   only bounds abuse *within a single warm instance* — it is best-effort defense-in-depth, not
//   a distributed guarantee. A durable fix requires a shared store (e.g. Vercel KV / Upstash
//   Redis) behind the same RateLimitSeam contract, which needs live credentials this
//   environment does not have.
