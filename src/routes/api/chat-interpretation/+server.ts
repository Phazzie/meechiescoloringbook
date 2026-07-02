/*
Purpose: Server endpoint for ChatInterpretationSeam using xAI chat completions.
Why: Keep API keys server-side while returning structured specs to the client.
Info flow: Client request -> provider adapter -> parsed spec -> response.
*/
import { json } from '@sveltejs/kit';
import {
	chatInterpretationPipelineDeps,
	runChatInterpretationPipeline
} from '$lib/core/chat-interpretation-pipeline';
import { enforceRateLimit } from '$lib/server/enforce-rate-limit';
import { parseRequestBody } from '$lib/server/parse-request-body';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request, getClientAddress }) => {
	const parsed = await parseRequestBody(request);
	if (!parsed.ok) return parsed.response;
	const rateLimitCheck = enforceRateLimit('chat-interpretation', getClientAddress());
	if (!rateLimitCheck.ok) return rateLimitCheck.response;
	const pipelineResult = await runChatInterpretationPipeline(parsed.body, chatInterpretationPipelineDeps);
	return json(pipelineResult.body, { status: pipelineResult.status });
};
