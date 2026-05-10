/*
Purpose: Server endpoint for MeechieStudioTextSeam.
Why: Keep AI text generation server-side and schema-validated.
Info flow: Client request -> studio text pipeline -> JSON response.
*/
import { json } from '@sveltejs/kit';
import {
	meechieStudioTextPipelineDeps,
	runMeechieStudioTextPipeline
} from '$lib/core/meechie-studio-text-pipeline';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request }) => {
	const body = await request.json().catch(() => null);
	const pipelineResult = await runMeechieStudioTextPipeline(body, meechieStudioTextPipelineDeps);
	return json(pipelineResult.body, { status: pipelineResult.status });
};
