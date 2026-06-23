// Purpose: Centralize generation endpoint orchestration in a reusable core pipeline.
// Why: Keep route handlers thin and isolate seam composition logic from transport concerns.
// Info flow: Raw request body -> validation/seams -> contract-shaped response payload.
import { driftDetectionAdapter } from '$lib/adapters/drift-detection-seam';
import { promptAssemblyAdapter } from '$lib/adapters/prompt-assembly-seam';
import { specValidationAdapter } from '$lib/adapters/spec-validation-seam';
import type {
	SafetyPolicyError,
	SafetyPolicyGenerateInput,
	SafetyPolicyResult
} from '$lib/seams/safety-policy-seam/contract';
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
};

type ImagePipelineResponse = {
	status: number;
	body: ImageGenerationResult;
};

export type GeneratePipelineDeps = {
	checkContentSafety: (input: SafetyPolicyGenerateInput) => SafetyPolicyResult;
	validateSpec: typeof specValidationAdapter.validate;
	assemblePrompt: typeof promptAssemblyAdapter.assemble;
	detectDrift: typeof driftDetectionAdapter.detect;
	generateImage: (body: ImageGenerationInput, signal?: AbortSignal) => Promise<ImagePipelineResponse>;
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
	return buildError(
		isTimeout ? 504 : 502,
		isTimeout ? 'IMAGE_GENERATION_TIMEOUT' : 'IMAGE_GENERATION_FAILED',
		isTimeout ? 'Image generation timed out.' : 'Image generation failed unexpectedly.',
		{ reason }
	);
};

export type GenerateInputShapeCheck =
	| { ok: true; data: z.infer<typeof GenerateRequestSchema> }
	| { ok: false; response: PipelineResponse };

// Exported so the route can reject schema-invalid bodies before consuming rate-limit
// quota, without duplicating the GENERATE_INPUT_INVALID code/message in two places.
export const checkGenerateInputShape = (body: unknown): GenerateInputShapeCheck => {
	const parsedInput = GenerateRequestSchema.safeParse(body);
	if (!parsedInput.success) {
		return {
			ok: false,
			response: buildError(400, 'GENERATE_INPUT_INVALID', 'Generate request is invalid.')
		};
	}
	return { ok: true, data: parsedInput.data };
};

export type GenerateSafetyCheck = { ok: true } | { ok: false; response: PipelineResponse };

// Exported so the route can reject content-policy-violating bodies before consuming
// rate-limit quota, without duplicating the CONTENT_POLICY_VIOLATION code/message.
export const checkGenerateSafety = (
	data: z.infer<typeof GenerateRequestSchema>,
	checkContentSafety: GeneratePipelineDeps['checkContentSafety']
): GenerateSafetyCheck => {
	const safetyResult = checkContentSafety({
		spec: data.spec,
		styleHint: data.styleHint
	});
	if (!safetyResult.ok) {
		return {
			ok: false,
			response: buildError(
				400,
				'CONTENT_POLICY_VIOLATION',
				safetyResult.error.message,
				safetyErrorDetails(safetyResult.error)
			)
		};
	}
	return { ok: true };
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

	const shapeCheck = checkGenerateInputShape(body);
	if (!shapeCheck.ok) return shapeCheck.response;
	const parsedInput = { data: shapeCheck.data };

	const safetyCheck = checkGenerateSafety(parsedInput.data, deps.checkContentSafety);
	if (!safetyCheck.ok) return safetyCheck.response;

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
	try {
		imageResult = await deps.generateImage(imageRequest, deps.signal);
	} catch (error) {
		return imageExceptionResponse(error);
	}

	const parsedImageResult = ImageGenerationResultSchema.safeParse(imageResult.body);
	if (!parsedImageResult.success) {
		return buildError(
			502,
			'IMAGE_RESPONSE_INVALID',
			'Image generation response did not match contract.'
		);
	}
	if (!parsedImageResult.data.ok) {
		return {
			status: imageResult.status >= 400 ? imageResult.status : 502,
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
