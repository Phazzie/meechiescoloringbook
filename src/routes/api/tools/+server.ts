/*
Purpose: Server endpoint for MeechieToolSeam with input safety checks.
Why: Keep tool execution behind a server boundary and reject disallowed content.
Info flow: Client tool request -> schema + safety checks -> tool adapter -> JSON result.
*/
import { json } from '@sveltejs/kit';
import { createRateLimitSeam } from '$lib/adapters/rate-limit-seam';
import { runToolsPipeline, toolsPipelineDeps } from '$lib/core/tools-pipeline';
import { safeClientAddress } from '$lib/server/client-address';
import { parseRequestBody } from '$lib/server/parse-request-body';
import { rateLimitedResponse } from '$lib/server/rate-limit-response';
import type { RequestHandler } from './$types';

const rateLimitSeam = createRateLimitSeam({ limit: 20, windowMs: 60_000 });

export const POST: RequestHandler = async ({ request, getClientAddress }) => {
	const rateLimitResult = rateLimitSeam.checkAndConsume(safeClientAddress(getClientAddress), Date.now());
	if (!rateLimitResult.ok) return rateLimitedResponse(rateLimitResult.error);

	const parsed = await parseRequestBody(request);
	if (!parsed.ok) return parsed.response;
	const pipelineResult = await runToolsPipeline(parsed.body, toolsPipelineDeps);
	return json(pipelineResult.body, { status: pipelineResult.status });
};
