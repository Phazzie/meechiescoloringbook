/*
Purpose: Server endpoint for MeechieStudioTextSeam.
Why: Keep AI text generation server-side, schema-validated, and rate limited per caller.
Info flow: Client request -> parse guard -> text-bucket quota gate -> studio text pipeline -> JSON response.
*/
import { env } from '$env/dynamic/private';
import { createProviderAdapter } from '$lib/adapters/provider-adapter.adapter';
import { json } from '@sveltejs/kit';
import {
	runMeechieStudioTextPipeline,
	type MeechieStudioTextPipelineDeps
} from '$lib/core/meechie-studio-text-pipeline';
import { parseRequestBody } from '$lib/server/parse-request-body';
import { createQuotaGate } from '$lib/server/rate-limit-route';
import type { RequestHandler } from './$types';

// The global maxDuration in svelte.config.js (120s) is sized for image generation.
// This route's own pipeline can make two sequential provider chat calls at up to 110s
// each (see the STUDIO_TEXT_QUOTA_COST comment in meechie-studio-text-pipeline.ts and
// the studioText budget in http-client.ts), so it needs its own, longer function budget
// or the platform kills a legitimately slow-but-succeeding request before it can respond.
export const config = { maxDuration: 230 };

export const POST: RequestHandler = async (event) => {
	const parsed = await parseRequestBody(event.request);
	if (!parsed.ok) return parsed.response;
	const deps: MeechieStudioTextPipelineDeps = {
		createProvider: createProviderAdapter,
		// Built from this route's own event so the guard meters the real caller rather than
		// collapsing the whole internet into one shared fallback bucket.
		consumeQuota: createQuotaGate(event, 'text'),
		isProduction: env.NODE_ENV === 'production'
	};
	const pipelineResult = await runMeechieStudioTextPipeline(parsed.body, deps);
	// Quota headers pass through untouched, on success as well as on denial.
	return json(pipelineResult.body, {
		status: pipelineResult.status,
		headers: pipelineResult.headers
	});
};
