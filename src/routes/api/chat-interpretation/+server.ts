/*
Purpose: Server endpoint for ChatInterpretationSeam using xAI chat completions.
Why: Keep API keys server-side while returning structured specs to the client.
Info flow: Client request -> provider adapter -> parsed spec -> response.
*/
import { env } from '$env/dynamic/private';
import { json } from '@sveltejs/kit';
import { runChatInterpretationPipeline } from '$lib/core/chat-interpretation-pipeline';
import { providerAdapter } from '$lib/adapters/provider-adapter.adapter';
import { specValidationAdapter } from '$lib/adapters/spec-validation-seam';
import { parseRequestBody } from '$lib/server/parse-request-body';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request }) => {
	const parsed = await parseRequestBody(request);
	if (!parsed.ok) return parsed.response;
	const pipelineResult = await runChatInterpretationPipeline(parsed.body, {
		createChatCompletion: (input) => providerAdapter.createChatCompletion(input),
		validateSpec: (input) => specValidationAdapter.validate(input),
		model: env.XAI_TEXT_MODEL
	});
	return json(pipelineResult.body, { status: pipelineResult.status });
};
