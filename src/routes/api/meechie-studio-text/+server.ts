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
