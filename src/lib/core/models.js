// Purpose: Pin the xAI model ids used across every provider-backed text, image, and edit seam.
// Why: A model id is not a secret and does not vary per environment, so it belongs in code
//      where a diff shows the change and a grep finds it. Plain checked JavaScript keeps the
//      same source directly importable by the repository's documented Node 22 probes.
// Info flow: these constants -> chat/tool/studio/image seams and probes -> provider request.
export const TEXT_MODEL = 'grok-4.6';
// Upgraded 2026-08-26 after the compatibility gap the previous note describes was finally
// closed by direct measurement against the live API rather than inference.
//
// Both models were driven through POST /v1/images/generations with a representative
// coloring-page prompt. grok-imagine-image rendered the title correctly and then filled the
// item list with hallucinated near-misses of it — "HE FIONE DIED", "HE BONE DIED",
// "TK IONE DIED" — which is an unusable page. 2.0 never produced garbled text in any sample;
// it either wrote real list items or left clean write-in lines, both of which a person can
// actually colour.
//
// The cost is latency, and it is large: 5-6s on the old model against 71-94s on 2.0, measured
// twice each. That is why svelte.config.js now sets an explicit maxDuration — the platform
// default would kill the function long before a successful 2.0 response arrived, and the
// adapter's own 120s budget leaves only ~26s of headroom over the slowest sample observed.
// If generation starts timing out, this pin and that budget are the first two things to look
// at, in that order.
export const IMAGE_MODEL = 'grok-imagine-image-2.0';
// Wig try-on is a multi-image edit path, so it uses the separately verified image-edit model
// without changing the live-verified model used for ordinary coloring-page generation.
export const IMAGE_EDIT_MODEL = 'grok-imagine-image-2.0';
