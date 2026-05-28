// Purpose: Centralize generation endpoint orchestration in a reusable core pipeline.
// Why: Keep route handlers thin and isolate seam composition logic from transport concerns.
// Info flow: Raw request body -> validation/seams -> contract-shaped response payload.
import { driftDetectionAdapter } from '$lib/adapters/drift-detection.adapter';
import { promptAssemblyAdapter } from '$lib/adapters/prompt-assembly.adapter';
import { specValidationAdapter } from '$lib/adapters/spec-validation.adapter';
import {
	GenerateRequestSchema,
	GenerateResultSchema
} from '../../../contracts/generate.contract';
import { ImageGenerationResultSchema } from '../../../contracts/image-generation.contract';
import { z } from 'zod';

type GenerateResult = z.infer<typeof GenerateResultSchema>;

type PipelineResponse = {
	status: number;
	body: GenerateResult;
};

const PIPELINE_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes — outer safety net for the full generation round-trip.

type PipelineDeps = {
	fetchImpl: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
	validateSpec: typeof specValidationAdapter.validate;
	assemblePrompt: typeof promptAssemblyAdapter.assemble;
	detectDrift: typeof driftDetectionAdapter.detect;
	signal?: AbortSignal;
};

const buildError = (
	status: number,
	code: string,
	message: string,
	details?: Record<string, string>
): PipelineResponse => ({
	status,
	body: {
		ok: false,
		error: {
			code,
			message,
			...(details ? { details } : {})
		}
	}
});

const defaultDeps = {
	validateSpec: specValidationAdapter.validate,
	assemblePrompt: promptAssemblyAdapter.assemble,
	detectDrift: driftDetectionAdapter.detect
};

export const runGeneratePipeline = async (
	body: unknown,
	deps: PipelineDeps
): Promise<PipelineResponse> => {
	const controller = new AbortController();
	const timeoutId = setTimeout(
		() => controller.abort(new DOMException('Pipeline timeout', 'TimeoutError')),
		PIPELINE_TIMEOUT_MS
	);
	const signals: AbortSignal[] = [controller.signal];
	if (deps.signal) signals.push(deps.signal);
	const pipelineSignal = signals.length > 1 ? AbortSignal.any(signals) : signals[0];

	try {
		return await _runGeneratePipeline(body, deps, pipelineSignal);
	} finally {
		clearTimeout(timeoutId);
	}
};

const _runGeneratePipeline = async (
	body: unknown,
	deps: PipelineDeps,
	pipelineSignal: AbortSignal
): Promise<PipelineResponse> => {
	const parsedInput = GenerateRequestSchema.safeParse(body);
	if (!parsedInput.success) {
		return buildError(400, 'GENERATE_INPUT_INVALID', 'Generate request is invalid.');
	}

	const validation = await deps.validateSpec({ spec: parsedInput.data.spec });
	if (!validation.ok) {
		const issue = validation.issues[0];
		return buildError(
			400,
			'SPEC_INVALID',
			issue ? issue.message : 'Spec validation failed.',
			{ issueCount: String(validation.issues.length) }
		);
	}

	const promptResult = await deps.assemblePrompt({
		spec: parsedInput.data.spec,
		styleHint: parsedInput.data.styleHint
	});
	if (!promptResult.ok) {
		return {
			status: 400,
			body: {
				ok: false,
				error: promptResult.error
			}
		};
	}

	let imageResponse: Response;
	try {
		imageResponse = await deps.fetchImpl('/api/image-generation', {
			signal: pipelineSignal,
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				spec: parsedInput.data.spec,
				prompt: promptResult.value.prompt,
				variations: parsedInput.data.spec.variations,
				outputFormat: parsedInput.data.spec.outputFormat
			})
		});
	} catch (error) {
		if (error instanceof DOMException && (error.name === 'TimeoutError' || error.name === 'AbortError')) {
			return buildError(504, 'GENERATE_TIMEOUT', 'Generation timed out waiting for image generation.');
		}
		return buildError(502, 'IMAGE_FETCH_FAILED', 'Image generation request failed.');
	}
	const imagePayload = await imageResponse.json().catch(() => null);
	if (imagePayload === null) {
		return imageResponse.ok
			? buildError(502, 'IMAGE_RESPONSE_INVALID', 'Image generation response did not match contract.')
			: buildError(imageResponse.status, 'IMAGE_HTTP_ERROR', `Image generation returned HTTP ${imageResponse.status}.`, { status: String(imageResponse.status) });
	}
	const parsedImageResult = ImageGenerationResultSchema.safeParse(imagePayload);
	if (!parsedImageResult.success) {
		return buildError(
			502,
			'IMAGE_RESPONSE_INVALID',
			'Image generation response did not match contract.'
		);
	}
	if (!parsedImageResult.data.ok) {
		return {
			status: imageResponse.ok ? 502 : imageResponse.status,
			body: parsedImageResult.data
		};
	}

	const driftResult = await deps.detectDrift({
		spec: parsedInput.data.spec,
		promptSent: promptResult.value.prompt,
		revisedPrompt: parsedImageResult.data.value.revisedPrompt
	});

	const result: GenerateResult = {
		ok: true,
		value: {
			prompt: promptResult.value.prompt,
			templateVersion: promptResult.value.templateVersion,
			images: parsedImageResult.data.value.images,
			revisedPrompt: parsedImageResult.data.value.revisedPrompt,
			modelMetadata: parsedImageResult.data.value.modelMetadata,
			violations: driftResult.ok ? driftResult.value.violations : [],
			recommendedFixes: driftResult.ok ? driftResult.value.recommendedFixes : []
		}
	};

	const parsedResult = GenerateResultSchema.safeParse(result);
	if (!parsedResult.success) {
		return buildError(500, 'GENERATE_OUTPUT_INVALID', 'Generate response did not match contract.');
	}

	return {
		status: 200,
		body: parsedResult.data
	};
};

export const generatePipelineDeps = defaultDeps;
