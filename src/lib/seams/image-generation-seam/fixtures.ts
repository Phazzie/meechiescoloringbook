// Purpose: Provide fixture data for ImageGenerationSeam.
// Why: Ensure deterministic mock and test inputs.
// Info flow: fixtures -> mocks/tests.
import type { ImageGenerationRequest } from './contract';

export const imageGenerationRequestFixture: ImageGenerationRequest = {
	prompt: 'a glam kitten wearing a bow',
	negativePrompt: 'color, shading, gradient',
	n: 2,
	size: '512x512',
	format: 'url'
};

export const imageGenerationFaultFixture = {
	code: 'IMAGE_HTTP_ERROR',
	message: 'xAI returned 429 Too Many Requests',
	details: { status: '429' }
} as const;
