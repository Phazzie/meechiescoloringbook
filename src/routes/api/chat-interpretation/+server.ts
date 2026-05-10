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
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request }) => {
	const body = await request.json().catch(() => null);
	const pipelineResult = await runChatInterpretationPipeline(body, chatInterpretationPipelineDeps);
	return json(pipelineResult.body, { status: pipelineResult.status });
};
