/*
Purpose: Server endpoint for MeechieToolSeam with input safety checks.
Why: Keep tool execution behind a server boundary and reject disallowed content.
Info flow: Client tool request -> schema + safety checks -> tool adapter -> JSON result.
*/
import { json } from '@sveltejs/kit';
import { runToolsPipeline, toolsPipelineDeps } from '$lib/core/tools-pipeline';
import { enforceRateLimit } from '$lib/server/enforce-rate-limit';
import { parseRequestBody } from '$lib/server/parse-request-body';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request, getClientAddress }) => {
	const rateLimitCheck = enforceRateLimit('tools', getClientAddress());
	if (!rateLimitCheck.ok) return rateLimitCheck.response;
	const parsed = await parseRequestBody(request);
	if (!parsed.ok) return parsed.response;
	const pipelineResult = await runToolsPipeline(parsed.body, toolsPipelineDeps);
	return json(pipelineResult.body, { status: pipelineResult.status });
};
