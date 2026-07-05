/*
Purpose: Server endpoint for MeechieToolSeam with input safety checks.
Why: Keep tool execution behind a server boundary and reject disallowed content.
Info flow: Client tool request -> schema + safety checks -> tool adapter -> JSON result.
*/
import { json } from '@sveltejs/kit';
import { createImageProviderConfigSeam } from '$lib/adapters/image-provider-config-seam';
import {
	checkMeechieToolAbort,
	checkMeechieToolInputShape,
	checkMeechieToolProviderConfig,
	checkMeechieToolSafety,
	runToolsPipeline,
	toolsPipelineDeps
} from '$lib/core/tools-pipeline';
import { enforceAiRateLimit } from '$lib/server/rate-limiter';
import { parseRequestBody } from '$lib/server/parse-request-body';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request, getClientAddress }) => {
	const abortCheck = checkMeechieToolAbort(request.signal);
	if (!abortCheck.ok) return json(abortCheck.response.body, { status: abortCheck.response.status });
	const parsed = await parseRequestBody(request);
	if (!parsed.ok) return parsed.response;
	const shapeCheck = checkMeechieToolInputShape(parsed.body);
	if (!shapeCheck.ok) return json(shapeCheck.response.body, { status: shapeCheck.response.status });
	const safetyCheck = checkMeechieToolSafety(shapeCheck.data);
	if (!safetyCheck.ok)
		return json(safetyCheck.response.body, { status: safetyCheck.response.status });
	// parseRequestBody above is awaited, so a client can disconnect during that
	// window; re-check here to avoid burning a rate-limit slot for no paid work.
	const lateAbortCheck = checkMeechieToolAbort(request.signal);
	if (!lateAbortCheck.ok)
		return json(lateAbortCheck.response.body, { status: lateAbortCheck.response.status });
	const configCheck = checkMeechieToolProviderConfig(createImageProviderConfigSeam());
	if (!configCheck.ok)
		return json(configCheck.response.body, { status: configCheck.response.status });
	const limited = enforceAiRateLimit(getClientAddress);
	if (limited) return limited;
	const pipelineResult = await runToolsPipeline(parsed.body, {
		...toolsPipelineDeps,
		signal: request.signal
	});
	return json(pipelineResult.body, { status: pipelineResult.status });
};
