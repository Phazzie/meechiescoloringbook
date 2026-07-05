/*
Purpose: Server endpoint for ChatInterpretationSeam using xAI chat completions.
Why: Keep API keys server-side while returning structured specs to the client.
Info flow: Client request -> provider adapter -> parsed spec -> response.
*/
import { json } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import {
	chatInterpretationPipelineDeps,
	checkChatInterpretationAbort,
	checkChatInterpretationInputShape,
	checkChatInterpretationProviderConfig,
	runChatInterpretationPipeline
} from '$lib/core/chat-interpretation-pipeline';
import { enforceAiRateLimit } from '$lib/server/rate-limiter';
import { parseRequestBody } from '$lib/server/parse-request-body';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request, getClientAddress }) => {
	const abortCheck = checkChatInterpretationAbort(request.signal);
	if (!abortCheck.ok) return json(abortCheck.response.body, { status: abortCheck.response.status });
	const parsed = await parseRequestBody(request);
	if (!parsed.ok) return parsed.response;
	const shapeCheck = checkChatInterpretationInputShape(parsed.body);
	if (!shapeCheck.ok) return json(shapeCheck.response.body, { status: shapeCheck.response.status });
	// parseRequestBody above is awaited, so a client can disconnect during that
	// window; re-check here to avoid burning a rate-limit slot for no paid work.
	const lateAbortCheck = checkChatInterpretationAbort(request.signal);
	if (!lateAbortCheck.ok)
		return json(lateAbortCheck.response.body, { status: lateAbortCheck.response.status });
	const configCheck = checkChatInterpretationProviderConfig(env.XAI_API_KEY);
	if (!configCheck.ok)
		return json(configCheck.response.body, { status: configCheck.response.status });
	const limited = enforceAiRateLimit(getClientAddress);
	if (limited) return limited;
	const pipelineResult = await runChatInterpretationPipeline(parsed.body, {
		...chatInterpretationPipelineDeps,
		signal: request.signal
	});
	return json(pipelineResult.body, { status: pipelineResult.status });
};
