// Purpose: Centralize image-generation endpoint orchestration in a reusable core pipeline.
// Why: Keep route handlers thin and make validation/provider behavior easier to test.
// Info flow: Raw request body + headers -> validation/provider calls -> contract-shaped response.
import { createProviderAdapter } from '$lib/adapters/provider-adapter.adapter';
import { SYSTEM_CONSTANTS } from '$lib/core/constants';
import { env } from '$env/dynamic/private';
import { z } from 'zod';
import {
	ImageGenerationInputSchema,
	ImageGenerationResultSchema,
	type GeneratedImage
} from '../../../contracts/image-generation.contract';

const IMAGE_MODEL = env.XAI_IMAGE_MODEL || 'grok-imagine-image';
const RESPONSE_FORMAT = 'b64_json';
const REQUIRED_PHRASES = SYSTEM_CONSTANTS.REQUIRED_PROMPT_PHRASES;

type ImageGenerationResult = z.infer<typeof ImageGenerationResultSchema>;

type ImagePipelineResponse = {
	status: number;
	body: ImageGenerationResult;
};

type ImagePipelineDeps = {
	createProvider: typeof createProviderAdapter;
};

const pageSizeLine = (pageSize: string): string =>
	pageSize === 'A4' ? 'A4 8.27x11.69 portrait.' : 'US Letter 8.5x11 portrait.';

const missingRequiredPhrases = (prompt: string, pageSize: string): string[] => {
	const promptLower = prompt.toLowerCase();
	const phrases = [...REQUIRED_PHRASES, pageSizeLine(pageSize)].map((phrase) => phrase.toLowerCase());
	return phrases.filter((phrase) => !promptLower.includes(phrase));
};

const errorResponse = (status: number, code: string, message: string): ImagePipelineResponse => ({
	status,
	body: {
		ok: false,
		error: {
			code,
			message
		}
	}
});

export const runImageGenerationPipeline = async (
	body: unknown,
	requestHeaders: Headers,
	deps: ImagePipelineDeps
): Promise<ImagePipelineResponse> => {
	const parsedInput = ImageGenerationInputSchema.safeParse(body);
	if (!parsedInput.success) {
		return errorResponse(400, 'IMAGE_INPUT_INVALID', 'Image generation input is invalid.');
	}

	const { prompt, variations, spec } = parsedInput.data;
	const missing = missingRequiredPhrases(prompt, spec.pageSize);
	if (missing.length > 0) {
		return errorResponse(
			400,
			'PROMPT_MISSING_REQUIRED_PHRASES',
			'Prompt missing required phrases for deterministic generation.'
		);
	}

	const requestApiKey = requestHeaders.get('x-api-key')?.trim() || undefined;
	const providerAdapter = deps.createProvider({
		apiKey: requestApiKey
	});

	const providerResult = await providerAdapter.createImageGeneration({
		model: IMAGE_MODEL,
		prompt,
		n: variations,
		responseFormat: RESPONSE_FORMAT
	});
	if (!providerResult.ok) {
		const isMissingKey = providerResult.error.code === 'PROVIDER_API_KEY_MISSING';
		return {
			status: isMissingKey ? 401 : 502,
			body: {
				ok: false,
				error: {
					...providerResult.error,
					message: isMissingKey
						? 'Image generation key missing. Add API key in the UI panel or set XAI_API_KEY on the server.'
						: providerResult.error.message
				}
			}
		};
	}

	const images: GeneratedImage[] = [];
	for (const [index, image] of providerResult.value.images.entries()) {
		if (!image.b64_json) {
			continue;
		}
		images.push({
			id: `image-${index + 1}`,
			format: 'png',
			mimeType: 'image/png',
			data: image.b64_json,
			encoding: 'base64'
		});
	}

	if (images.length === 0) {
		return errorResponse(502, 'PROVIDER_EMPTY_IMAGE', 'Provider returned no images.');
	}

	const result: ImageGenerationResult = {
		ok: true,
		value: {
			images,
			revisedPrompt: providerResult.value.revisedPrompt,
			modelMetadata: {
				provider: 'xai',
				model: IMAGE_MODEL
			}
		}
	};

	const parsedResult = ImageGenerationResultSchema.safeParse(result);
	if (!parsedResult.success) {
		return errorResponse(500, 'IMAGE_OUTPUT_INVALID', 'Image generation response did not match contract.');
	}

	return {
		status: 200,
		body: parsedResult.data
	};
};

export const imageGenerationPipelineDeps: ImagePipelineDeps = {
	createProvider: createProviderAdapter
};
