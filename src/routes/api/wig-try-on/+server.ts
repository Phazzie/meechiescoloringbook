// Purpose: Handle wig try-on requests by running the Gemini multi-image pipeline.
// Why: Keep the endpoint thin and delegate orchestration to the pipeline.
// Info flow: UI selfie + wigId -> rate limit gate -> pipeline -> WigCatalogSeam + WigTryOnSeam -> portrait JSON.
import { json } from '@sveltejs/kit';
import { createAppConfigSeam } from '$lib/adapters/app-config-seam/index';
import { createRateLimitSeam } from '$lib/adapters/rate-limit-seam';
import { createWigCatalogSeam } from '$lib/adapters/wig-catalog-seam/index';
import { createWigTryOnSeam } from '$lib/adapters/wig-try-on-seam/index';
import { runWigTryOnPipeline } from '$lib/core/wig-try-on-pipeline';
import { safeClientAddress } from '$lib/server/client-address';
import { parseRequestBody } from '$lib/server/parse-request-body';
import { rateLimitedResponse } from '$lib/server/rate-limit-response';
import type { RequestHandler } from './$types';

const rateLimitSeam = createRateLimitSeam({ limit: 5, windowMs: 60_000 });

export const POST: RequestHandler = async ({ request, fetch, getClientAddress }) => {
	const rateLimitResult = rateLimitSeam.checkAndConsume(safeClientAddress(getClientAddress), Date.now());
	if (!rateLimitResult.ok) return rateLimitedResponse(rateLimitResult.error);

	const parsed = await parseRequestBody(request);
	if (!parsed.ok) return parsed.response;

	const configSeam = createAppConfigSeam();
	const wigCatalogSeam = createWigCatalogSeam();
	const wigTryOnSeam = createWigTryOnSeam(configSeam);

	const result = await runWigTryOnPipeline(parsed.body, {
		fetchImpl: fetch,
		wigCatalogSeam,
		wigTryOnSeam,
		signal: request.signal
	});

	return json(result.body, { status: result.status });
};
