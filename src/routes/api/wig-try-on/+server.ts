// Purpose: Handle wig try-on requests through the xAI multi-image edit pipeline.
// Why: Keep the endpoint thin and delegate orchestration to the pipeline.
// Info flow: UI selfie + wigId -> quota gate -> pipeline -> WigCatalogSeam + WigTryOnSeam -> portrait JSON.
import { json } from '@sveltejs/kit';
import { createImageProviderConfigSeam } from '$lib/adapters/image-provider-config-seam/index';
import { createWigCatalogSeam } from '$lib/adapters/wig-catalog-seam/index';
import { createWigTryOnSeam } from '$lib/adapters/wig-try-on-seam/index';
import { runWigTryOnPipeline } from '$lib/core/wig-try-on-pipeline';
import { parseRequestBody } from '$lib/server/parse-request-body';
import { createQuotaGate } from '$lib/server/rate-limit-route';
import type { RequestHandler } from './$types';

// The global maxDuration in svelte.config.js (120s) matches WIG_TRY_ON_TIMEOUT_MS, the one
// provider call this route makes — but wigImageUrlSchema (wig-catalog-seam/validators.ts)
// also accepts absolute HTTP(S) image URLs, not just packaged /wigs paths, even though every
// entry in the current catalog happens to use a packaged path today. If a catalog entry ever
// does use an external URL, fetchImageAsBase64 adds an unbounded network fetch before the
// provider call, inside the same 120s budget. This override gives that case headroom, matching
// the client's own wigTryOn timeout in http-client.ts.
export const config = { maxDuration: 150 };

export const POST: RequestHandler = async (event) => {
	// `event` itself is threaded into the gate so the limiter meters this caller through
	// SvelteKit's real getClientAddress; `fetch` stays destructured for the wig image load.
	const { request, fetch } = event;
	const parsed = await parseRequestBody(request);
	if (!parsed.ok) return parsed.response;

	const configSeam = createImageProviderConfigSeam();
	const wigCatalogSeam = createWigCatalogSeam();
	const wigTryOnSeam = createWigTryOnSeam(configSeam);

	const result = await runWigTryOnPipeline(parsed.body, {
		fetchImpl: fetch,
		wigCatalogSeam,
		wigTryOnSeam,
		// A try-on spends one provider image edit, so it charges the image bucket once.
		consumeQuota: createQuotaGate(event, 'image'),
		signal: request.signal
	});

	// Headers are passed through exactly as the gate produced them, never recomputed here.
	return json(result.body, { status: result.status, headers: result.headers });
};
