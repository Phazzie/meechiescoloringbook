/*
Purpose: Server endpoint for ImageGenerationSeam using xAI image generation.
Why: Keep xAI API keys server-side and return normalized image artifacts.
Info flow: Client request -> provider adapter -> image normalization -> response.
*/
import { json } from '@sveltejs/kit';
import { ImageGenerationInputSchema } from '../../../../contracts/image-generation.contract';
import type { GeneratedImage } from '../../../../contracts/image-generation.contract';
import { providerAdapter } from '$lib/adapters/provider-adapter.adapter';
import type { RequestHandler } from './$types';

const IMAGE_MODEL = 'grok-2-image-1212';
const RESPONSE_FORMAT = 'b64_json';

const REQUIRED_PHRASES = [
	'black-and-white coloring book page',
	'outline-only',
	'easy to color',
	'Crisp vector-like linework',
	'NEGATIVE PROMPT:'
];

const pageSizeLine = (pageSize: string): string =>
	pageSize === 'A4' ? 'A4 8.27x11.69 portrait.' : 'US Letter 8.5x11 portrait.';

const missingRequiredPhrases = (prompt: string, pageSize: string): string[] => {
	const phrases = [...REQUIRED_PHRASES, pageSizeLine(pageSize)];
	return phrases.filter((phrase) => !prompt.includes(phrase));
};

export const POST: RequestHandler = async ({ request }) => {
	const body = await request.json().catch(() => null);
	const parsedInput = ImageGenerationInputSchema.safeParse(body);
	if (!parsedInput.success) {
		return json({
			ok: false,
			error: {
				code: 'IMAGE_INPUT_INVALID',
				message: 'Image generation input is invalid.'
			}
		});
	}

	const { prompt, variations, spec } = parsedInput.data;
	const missing = missingRequiredPhrases(prompt, spec.pageSize);
	if (missing.length > 0) {
		return json({
			ok: false,
			error: {
				code: 'PROMPT_MISSING_REQUIRED_PHRASES',
				message: 'Prompt missing required phrases for deterministic generation.'
			}
		});
	}

	const providerResult = await providerAdapter.createImageGeneration({
		model: IMAGE_MODEL,
		prompt,
		n: variations,
		responseFormat: RESPONSE_FORMAT
	});
	if (!providerResult.ok) {
		return json({
			ok: false,
			error: providerResult.error
		});
	}

	const images: GeneratedImage[] = providerResult.value.images
		.map((image, index) => {
			if (!image.b64_json) {
				return null;
			}
			return {
				id: `image-${index + 1}`,
				format: 'png',
				mimeType: 'image/png',
				data: image.b64_json,
				encoding: 'base64'
			};
		})
		.filter((image): image is GeneratedImage => image !== null);

	if (images.length === 0) {
		return json({
			ok: false,
			error: {
				code: 'PROVIDER_EMPTY_IMAGE',
				message: 'Provider returned no images.'
			}
		});
	}

	return json({
		ok: true,
		value: {
			images,
			revisedPrompt: providerResult.value.revisedPrompt,
			modelMetadata: {
				provider: 'xai',
				model: IMAGE_MODEL
			}
		}
	});
};
