// Purpose: Handle wig try-on requests by running the Gemini multi-image pipeline.
// Why: Keep the endpoint thin and delegate orchestration to the pipeline.
// Info flow: UI selfie + wigId -> pipeline -> WigCatalogSeam + WigTryOnSeam -> portrait JSON.
import { json } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import { createAppConfigSeam } from '$lib/adapters/app-config-seam/index';
import { createWigCatalogSeam } from '$lib/adapters/wig-catalog-seam/index';
import { createWigTryOnSeam } from '$lib/adapters/wig-try-on-seam/index';
import {
	checkWigCatalogPreflight,
	checkWigTryOnAbort,
	checkWigTryOnConfig,
	checkWigTryOnFullConfig,
	checkWigTryOnInputShape,
	runWigTryOnPipeline
} from '$lib/core/wig-try-on-pipeline';
import { enforceAiRateLimit } from '$lib/server/rate-limiter';
import { parseRequestBody } from '$lib/server/parse-request-body';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request, fetch, getClientAddress }) => {
	const abortCheck = checkWigTryOnAbort(request.signal);
	if (!abortCheck.ok) return json(abortCheck.response.body, { status: abortCheck.response.status });
	const parsed = await parseRequestBody(request);
	if (!parsed.ok) return parsed.response;
	const shapeCheck = checkWigTryOnInputShape(parsed.body);
	if (!shapeCheck.ok) return json(shapeCheck.response.body, { status: shapeCheck.response.status });

	const wigCatalogSeam = createWigCatalogSeam();
	const catalogCheck = await checkWigCatalogPreflight(shapeCheck.data.wigId, wigCatalogSeam);
	if (!catalogCheck.ok)
		return json(catalogCheck.response.body, { status: catalogCheck.response.status });

	// Catalog preflight above is awaited, so a client can disconnect during that window;
	// re-check here to avoid burning a rate-limit slot for no paid work.
	const lateAbortCheck = checkWigTryOnAbort(request.signal);
	if (!lateAbortCheck.ok)
		return json(lateAbortCheck.response.body, { status: lateAbortCheck.response.status });

	const configCheck = checkWigTryOnConfig(env.GEMINI_API_KEY);
	if (!configCheck.ok)
		return json(configCheck.response.body, { status: configCheck.response.status });

	// checkWigTryOnConfig only catches a missing Gemini key; createWigTryOnSeam also needs the
	// full AppConfigSeam (all XAI_* vars) the first time it runs. Validate it here too, before
	// charging rate-limit quota, so a misconfigured deployment fails without burning a slot.
	const configSeam = createAppConfigSeam();
	const fullConfigCheck = checkWigTryOnFullConfig(configSeam);
	if (!fullConfigCheck.ok)
		return json(fullConfigCheck.response.body, { status: fullConfigCheck.response.status });

	const limited = enforceAiRateLimit(getClientAddress);
	if (limited) return limited;

	const wigTryOnSeam = createWigTryOnSeam(configSeam);

	const result = await runWigTryOnPipeline(parsed.body, {
		fetchImpl: fetch,
		wigCatalogSeam,
		wigTryOnSeam,
		signal: request.signal,
		precomputedWig: catalogCheck.wig
	});

	return json(result.body, { status: result.status });
};
