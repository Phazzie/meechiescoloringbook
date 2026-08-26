/*
Purpose: Server endpoint for MeechieToolSeam with input safety checks and per-caller rate limiting.
Why: Keep tool execution behind a server boundary, reject disallowed content, and meter billable provider work.
Info flow: Client tool request -> schema + safety checks -> quota gate -> tool adapter -> JSON result.
*/
import { json } from '@sveltejs/kit';
import {
	createToolsPipelineDeps,
	runToolsPipeline
} from '$lib/core/tools-pipeline';
import { parseRequestBody } from '$lib/server/parse-request-body';
import { createQuotaGate } from '$lib/server/rate-limit-route';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async (event) => {
	const parsed = await parseRequestBody(event.request);
	if (!parsed.ok) return parsed.response;
	// Built from this route's own event so event.getClientAddress meters per caller.
	// The pipeline charges it once, after validation and safety checks.
	const pipelineResult = await runToolsPipeline(
		parsed.body,
		createToolsPipelineDeps(createQuotaGate(event, 'text'))
	);
	return json(pipelineResult.body, {
		status: pipelineResult.status,
		headers: pipelineResult.headers
	});
};
