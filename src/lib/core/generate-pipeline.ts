// Purpose: Centralize generation endpoint orchestration in a reusable core pipeline.
// Why: Keep route handlers thin and isolate seam composition logic from transport concerns.
// Info flow: Raw request body -> validation/seams -> contract-shaped response payload.
import { driftDetectionAdapter } from '$lib/adapters/drift-detection.adapter';
import { promptAssemblyAdapter } from '$lib/adapters/prompt-assembly.adapter';
import { specValidationAdapter } from '$lib/adapters/spec-validation.adapter';
import { runImageGenerationPipeline } from '$lib/core/image-generation-pipeline';
import type { ImageGenerationSeam } from '$lib/seams/image-generation-seam/contract';
import {
	GenerateRequestSchema,
	GenerateResultSchema
} from '../../../contracts/generate.contract';
import { z } from 'zod';

type GenerateResult = z.infer<typeof GenerateResultSchema>;

type PipelineResponse = {
	status: number;
	body: GenerateResult;
};

type PipelineDeps = {
	imageGenerationSeam: ImageGenerationSeam;
	validateSpec: typeof specValidationAdapter.validate;
	assemblePrompt: typeof promptAssemblyAdapter.assemble;
	detectDrift: typeof driftDetectionAdapter.detect;
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

	const imageResult = await runImageGenerationPipeline(
		{
			spec: parsedInput.data.spec,
			prompt: promptResult.value.prompt,
			variations: parsedInput.data.spec.variations,
			outputFormat: parsedInput.data.spec.outputFormat
		},
		{ imageGenerationSeam: deps.imageGenerationSeam }
	);
	if (!imageResult.body.ok) {
		return { status: imageResult.status, body: imageResult.body };
	}

	const driftResult = await deps.detectDrift({
		spec: parsedInput.data.spec,
		promptSent: promptResult.value.prompt,
		revisedPrompt: imageResult.body.value.revisedPrompt
	});

	const result: GenerateResult = {
		ok: true,
		value: {
			prompt: promptResult.value.prompt,
			templateVersion: promptResult.value.templateVersion,
			images: imageResult.body.value.images,
			revisedPrompt: imageResult.body.value.revisedPrompt,
			modelMetadata: imageResult.body.value.modelMetadata,
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
