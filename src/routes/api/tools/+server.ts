/*
Purpose: Server endpoint for MeechieToolSeam with input safety checks.
Why: Keep tool execution behind a server boundary and reject disallowed content.
Info flow: Client tool request -> schema + safety checks -> tool adapter -> JSON result.
*/
import { json } from '@sveltejs/kit';
import { rateLimitSeam } from '$lib/adapters/rate-limit-seam';
import { runToolsPipeline, toolsPipelineDeps } from '$lib/core/tools-pipeline';
import { TOOLS_RATE_LIMIT } from '$lib/server/rate-limit-config';
import { enforceRateLimit, resolveClientAddress } from '$lib/server/rate-limit-guard';
import { parseRequestBody } from '$lib/server/parse-request-body';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request, getClientAddress }) => {
	const limited = enforceRateLimit(rateLimitSeam, resolveClientAddress(getClientAddress), 'tools', TOOLS_RATE_LIMIT);
	if (limited) return limited;

	const parsed = await parseRequestBody(request);
	if (!parsed.ok) return parsed.response;
	const pipelineResult = await runToolsPipeline(parsed.body, toolsPipelineDeps);
	return json(pipelineResult.body, { status: pipelineResult.status });
};
