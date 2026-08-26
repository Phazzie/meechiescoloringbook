/*
Purpose: Server endpoint for ChatInterpretationSeam using xAI chat completions.
Why: Keep API keys server-side while returning structured specs to the client.
Info flow: Client request -> per-request quota gate -> provider adapter -> parsed spec -> response.
*/
import { json } from '@sveltejs/kit';
import {
	chatInterpretationPipelineDeps,
	runChatInterpretationPipeline
} from '$lib/core/chat-interpretation-pipeline';
import { parseRequestBody } from '$lib/server/parse-request-body';
import { createQuotaGate } from '$lib/server/rate-limit-route';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async (event) => {
	const parsed = await parseRequestBody(event.request);
	if (!parsed.ok) return parsed.response;
	const pipelineResult = await runChatInterpretationPipeline(parsed.body, {
		...chatInterpretationPipelineDeps,
		// Built from this route's own event: without the real getClientAddress every caller
		// would collapse into one shared bucket.
		consumeQuota: createQuotaGate(event, 'text'),
		signal: event.request.signal
	});
	return json(pipelineResult.body, {
		status: pipelineResult.status,
		// Guard headers, verbatim, on denials and on post-charge responses alike.
		headers: pipelineResult.headers
	});
};
