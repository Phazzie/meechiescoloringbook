/*
Purpose: Adapter implementation for ImageGenerationSeam.
Why: Call the server-side xAI endpoint and normalize contract results.
Info flow: Spec + prompt -> API endpoint -> generated images.
*/
import type {
	ImageGenerationInput,
	ImageGenerationOutput,
	ImageGenerationSeam
} from '../../../contracts/image-generation.contract';
import { ImageGenerationResultSchema } from '../../../contracts/image-generation.contract';
import type { Result } from '../../../contracts/shared.contract';
import { SYSTEM_CONSTANTS } from '$lib/core/constants';

const REQUIRED_PHRASES = SYSTEM_CONSTANTS.REQUIRED_PROMPT_PHRASES;

const pageSizeLine = (pageSize: ImageGenerationInput['spec']['pageSize']): string =>
	pageSize === 'A4' ? 'A4 8.27x11.69 portrait.' : 'US Letter 8.5x11 portrait.';

const missingRequiredPhrases = (prompt: string, pageSize: ImageGenerationInput['spec']['pageSize']) => {
	const promptLower = prompt.toLowerCase();
	const phrases = [...REQUIRED_PHRASES, pageSizeLine(pageSize)].map((phrase) =>
		phrase.toLowerCase()
	);
	return phrases.filter((phrase) => !promptLower.includes(phrase));
};

export const imageGenerationAdapter: ImageGenerationSeam = {
	generate: async (input: ImageGenerationInput): Promise<Result<ImageGenerationOutput>> => {
		const missing = missingRequiredPhrases(input.prompt, input.spec.pageSize);
		if (missing.length > 0) {
			return {
				ok: false,
				error: {
					code: 'PROMPT_MISSING_REQUIRED_PHRASES',
					message: 'Prompt missing required phrases for deterministic generation.'
				}
			};
		}

		try {
			const response = await fetch('/api/image-generation', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify(input)
			});
			const payload = await response.json();
			const parsed = ImageGenerationResultSchema.safeParse(payload);
			if (!parsed.success) {
				return {
					ok: false,
					error: {
						code: 'IMAGE_RESPONSE_INVALID',
						message: 'Image generation response did not match contract.'
					}
				};
			}
			return parsed.data;
		} catch (error) {
			return {
				ok: false,
				error: {
					code: 'IMAGE_NETWORK_ERROR',
					message: error instanceof Error ? error.message : 'Image request failed.'
				}
			};
		}
	}
};
