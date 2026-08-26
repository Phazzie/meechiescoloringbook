// Purpose: Centralize generation endpoint orchestration in a reusable core pipeline.
// Why: Keep route handlers thin and isolate seam composition logic from transport concerns.
// Info flow: Raw request body -> validation/seams -> quota charge -> precharged image pipeline -> contract-shaped response payload.
import { driftDetectionAdapter } from '$lib/adapters/drift-detection-seam';
import { promptAssemblyAdapter } from '$lib/adapters/prompt-assembly-seam';
import { specValidationAdapter } from '$lib/adapters/spec-validation-seam';
import type { ImageQuota } from '$lib/core/image-generation-pipeline';
import { toPublicProviderError } from '$lib/core/public-provider-error';
import type {
	SafetyPolicyError,
	SafetyPolicyGenerateInput,
	SafetyPolicyResult
} from '$lib/seams/safety-policy-seam/contract';
// Type-only: erased at build time, so the deterministic core keeps no runtime edge into $lib/server.
import type { QuotaGate } from '$lib/server/rate-limit-route';
import {
	GenerateRequestSchema,
	GenerateResultSchema
} from '../../../contracts/generate.contract';
import {
	ImageGenerationInputSchema,
	ImageGenerationResultSchema
} from '../../../contracts/image-generation.contract';
import { z } from 'zod';

type GenerateResult = z.infer<typeof GenerateResultSchema>;
type ImageGenerationInput = z.infer<typeof ImageGenerationInputSchema>;
type ImageGenerationResult = z.infer<typeof ImageGenerationResultSchema>;

type PipelineResponse = {
	status: number;
	body: GenerateResult;
	/** Rate-limit headers from the guard, verbatim. Present on every post-charge response. */
	headers?: Record<string, string>;
};

type ImagePipelineResponse = {
	status: number;
	body: ImageGenerationResult;
	headers?: Record<string, string>;
};

/** The adapter-backed half of the deps, safe to preset at module scope. */
export type GeneratePipelineAdapterDeps = {
	validateSpec: typeof specValidationAdapter.validate;
	assemblePrompt: typeof promptAssemblyAdapter.assemble;
	detectDrift: typeof driftDetectionAdapter.detect;
};

export type GeneratePipelineDeps = GeneratePipelineAdapterDeps & {
	checkContentSafety: (input: SafetyPolicyGenerateInput) => SafetyPolicyResult;
	/**
	 * Takes the quota this pipeline already paid for and must pass straight through to the image
	 * pipeline. Typed as ImageQuota so the wiring cannot invent an unmetered inner call: the only
	 * two things expressible are "charge" (not what this pipeline hands down) and "precharged".
	 */
	generateImage: (
		body: ImageGenerationInput,
		quota: ImageQuota,
		signal?: AbortSignal
	) => Promise<ImagePipelineResponse>;
	/**
	 * Required. Built per request from the route's own event so the charge lands on the real
	 * caller. This is the single charge for the whole request - the image pipeline underneath
	 * runs precharged - so an optional gate here would be both a bypass and a double-charge risk.
	 */
	consumeQuota: QuotaGate;
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

const defaultDeps: GeneratePipelineAdapterDeps = {
	validateSpec: specValidationAdapter.validate,
	assemblePrompt: promptAssemblyAdapter.assemble,
	detectDrift: driftDetectionAdapter.detect
};

const safetyErrorDetails = (error: SafetyPolicyError) => {
	const details: Record<string, string> = { policyCode: error.code };
	if (error.details?.length) {
		details.policyDetails = error.details.join(' | ');
	}
	return details;
};

const imageExceptionResponse = (error: unknown): PipelineResponse => {
	const reason = error instanceof Error ? error.message : String(error);
	const name = error instanceof Error ? error.name : '';
	const isTimeout = name === 'TimeoutError' || /timeout/i.test(reason);
	const publicError = toPublicProviderError(
		{
			code: isTimeout ? 'IMAGE_GENERATION_TIMEOUT' : 'IMAGE_GENERATION_FAILED',
			message: reason
		},
		{
			code: isTimeout ? 'IMAGE_GENERATION_TIMEOUT' : 'IMAGE_GENERATION_FAILED',
			message: isTimeout
				? 'Image generation timed out.'
				: 'Image generation failed unexpectedly.'
		}
	);
	return buildError(
		isTimeout ? 504 : 502,
		publicError.code,
		publicError.message
	);
};

export const runGeneratePipeline = async (
	body: unknown,
	deps: GeneratePipelineDeps
): Promise<PipelineResponse> => {
	if (deps.signal?.aborted) {
		return buildError(
			499,
			'GENERATE_ABORTED',
			'Generate request was canceled by the caller.'
		);
	}

	const parsedInput = GenerateRequestSchema.safeParse(body);
	if (!parsedInput.success) {
		return buildError(
			400,
			'GENERATE_INPUT_INVALID',
			'Generate request is invalid.'
		);
	}

	const safetyResult = deps.checkContentSafety({
		spec: parsedInput.data.spec,
		styleHint: parsedInput.data.styleHint
	});
	if (!safetyResult.ok) {
		return buildError(
			400,
			'CONTENT_POLICY_VIOLATION',
			safetyResult.error.message,
			safetyErrorDetails(safetyResult.error)
		);
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

	let imageResult: ImagePipelineResponse;
	const imageRequest = {
		spec: parsedInput.data.spec,
		prompt: promptResult.value.prompt,
		variations: parsedInput.data.spec.variations,
		outputFormat: parsedInput.data.spec.outputFormat
	};

	// The one charge for this request. Everything above - bad input, unsafe content, an invalid
	// spec, a prompt that would not assemble - rejects for free, and the image pipeline below is
	// handed `precharged`, so these units are spent exactly once no matter how deep the call
	// goes. Cost is read off `imageRequest` itself, the object whose `variations` becomes the
	// provider's `n`, so the units billed always equal the images actually requested.
	const quota = await deps.consumeQuota(imageRequest.variations);
	// Taken from the guard's decision as-is. Recomputing RateLimit-Reset from a route clock
	// drifts from the store that issued it.
	const quotaHeaders = quota.headers;
	if (!quota.ok) {
		return {
			status: quota.status,
			body: quota.body,
			headers: quotaHeaders
		};
	}

	// Every response from here on is post-charge, so it advertises the caller's remaining quota.
	const withQuotaHeaders = (
		response: PipelineResponse
	): PipelineResponse => ({ ...response, headers: quotaHeaders });

	try {
		imageResult = await deps.generateImage(
			imageRequest,
			// Already paid for, right here. The inner pipeline reuses this decision's headers
			// instead of consuming a second time.
			{ mode: 'precharged', headers: quotaHeaders },
			deps.signal
		);
	} catch (error) {
		return withQuotaHeaders(imageExceptionResponse(error));
	}

	const parsedImageResult = ImageGenerationResultSchema.safeParse(
		imageResult.body
	);
	if (!parsedImageResult.success) {
		return withQuotaHeaders(
			buildError(
				502,
				'IMAGE_RESPONSE_INVALID',
				'Image generation response did not match contract.'
			)
		);
	}
	if (!parsedImageResult.data.ok) {
		const publicError = toPublicProviderError(parsedImageResult.data.error, {
			code: 'IMAGE_GENERATION_FAILED',
			message: 'Image generation failed.'
		});
		return withQuotaHeaders(
			buildError(
				imageResult.status >= 400 ? imageResult.status : 502,
				publicError.code,
				publicError.message
			)
		);
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
		return withQuotaHeaders(
			buildError(
				500,
				'GENERATE_OUTPUT_INVALID',
				'Generate response did not match contract.'
			)
		);
	}

	return withQuotaHeaders({
		status: 200,
		body: parsedResult.data
	});
};

export const generatePipelineDeps: GeneratePipelineAdapterDeps = defaultDeps;
