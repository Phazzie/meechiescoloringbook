/*
Purpose: Server endpoint for MeechieToolSeam with input safety checks.
Why: Keep tool execution behind a server boundary and reject disallowed content.
Info flow: Client tool request -> schema + safety checks -> tool adapter -> JSON result.
*/
import { json } from '@sveltejs/kit';
import { runToolsPipeline, toolsPipelineDeps } from '$lib/core/tools-pipeline';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request }) => {
	const body = await request.json().catch(() => null);
	const pipelineResult = await runToolsPipeline(body, toolsPipelineDeps);
	return json(pipelineResult.body, { status: pipelineResult.status });
};
