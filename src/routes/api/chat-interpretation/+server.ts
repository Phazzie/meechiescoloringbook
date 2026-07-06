/*
Purpose: Server endpoint for ChatInterpretationSeam using xAI chat completions.
Why: Keep API keys server-side while returning structured specs to the client.
Info flow: Client request -> rate limit gate -> provider adapter -> parsed spec -> response.
*/
import { json } from '@sveltejs/kit';
import { createRateLimitSeam } from '$lib/adapters/rate-limit-seam';
import {
	chatInterpretationPipelineDeps,
	runChatInterpretationPipeline
} from '$lib/core/chat-interpretation-pipeline';
import { safeClientAddress } from '$lib/server/client-address';
import { parseRequestBody } from '$lib/server/parse-request-body';
import { rateLimitedResponse } from '$lib/server/rate-limit-response';
import type { RequestHandler } from './$types';

const rateLimitSeam = createRateLimitSeam({ limit: 10, windowMs: 60_000 });

export const POST: RequestHandler = async ({ request, getClientAddress }) => {
	const rateLimitResult = rateLimitSeam.checkAndConsume(safeClientAddress(getClientAddress), Date.now());
	if (!rateLimitResult.ok) return rateLimitedResponse(rateLimitResult.error);

	const parsed = await parseRequestBody(request);
	if (!parsed.ok) return parsed.response;
	const pipelineResult = await runChatInterpretationPipeline(parsed.body, chatInterpretationPipelineDeps);
	return json(pipelineResult.body, { status: pipelineResult.status });
};
