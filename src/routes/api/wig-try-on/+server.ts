// Purpose: Handle wig try-on requests through the xAI multi-image edit pipeline.
// Why: Keep the endpoint thin and delegate orchestration to the pipeline.
// Info flow: UI selfie + wigId -> pipeline -> WigCatalogSeam + WigTryOnSeam -> portrait JSON.
import { json } from '@sveltejs/kit';
import { createImageProviderConfigSeam } from '$lib/adapters/image-provider-config-seam/index';
import { createWigCatalogSeam } from '$lib/adapters/wig-catalog-seam/index';
import { createWigTryOnSeam } from '$lib/adapters/wig-try-on-seam/index';
import { runWigTryOnPipeline } from '$lib/core/wig-try-on-pipeline';
import { parseRequestBody } from '$lib/server/parse-request-body';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request, fetch }) => {
	const parsed = await parseRequestBody(request);
	if (!parsed.ok) return parsed.response;

	const configSeam = createImageProviderConfigSeam();
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
