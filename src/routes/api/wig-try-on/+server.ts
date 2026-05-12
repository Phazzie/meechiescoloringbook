// Purpose: Handle wig try-on requests by running the Gemini multi-image pipeline.
// Why: Keep the endpoint thin and delegate orchestration to the pipeline.
// Info flow: UI selfie + wigId -> pipeline -> WigCatalogSeam + WigTryOnSeam -> portrait JSON.
import { json } from '@sveltejs/kit';
import { createAppConfigSeam } from '$lib/adapters/app-config-seam/index';
import { createWigCatalogSeam } from '$lib/adapters/wig-catalog-seam/index';
import { createWigTryOnSeam } from '$lib/adapters/wig-try-on-seam/index';
import { runWigTryOnPipeline } from '$lib/core/wig-try-on-pipeline';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request, fetch }) => {
	const body = await request.json().catch(() => null);

	const configSeam = createAppConfigSeam();
	const wigCatalogSeam = createWigCatalogSeam();
	const wigTryOnSeam = createWigTryOnSeam(configSeam);

	const result = await runWigTryOnPipeline(body, {
		fetchImpl: fetch,
		wigCatalogSeam,
		wigTryOnSeam
	});

	return json(result.body, { status: result.status });
};
