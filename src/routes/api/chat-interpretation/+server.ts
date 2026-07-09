/*
Purpose: Server endpoint for ChatInterpretationSeam using xAI chat completions.
Why: Keep API keys server-side while returning structured specs to the client.
Info flow: Client request -> provider adapter -> parsed spec -> response.
*/
import { json } from '@sveltejs/kit';
import { rateLimitSeam } from '$lib/adapters/rate-limit-seam';
import {
	chatInterpretationPipelineDeps,
	runChatInterpretationPipeline
} from '$lib/core/chat-interpretation-pipeline';
import { CHAT_INTERPRETATION_RATE_LIMIT } from '$lib/server/rate-limit-config';
import { enforceRateLimit } from '$lib/server/rate-limit-guard';
import { parseRequestBody } from '$lib/server/parse-request-body';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request, getClientAddress }) => {
	const limited = enforceRateLimit(
		rateLimitSeam,
		getClientAddress(),
		'chat-interpretation',
		CHAT_INTERPRETATION_RATE_LIMIT
	);
	if (limited) return limited;

	const parsed = await parseRequestBody(request);
	if (!parsed.ok) return parsed.response;
	const pipelineResult = await runChatInterpretationPipeline(parsed.body, chatInterpretationPipelineDeps);
	return json(pipelineResult.body, { status: pipelineResult.status });
};
