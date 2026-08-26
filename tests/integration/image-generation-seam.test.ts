// Purpose: Keep an explicitly gated live integration test for ImageGenerationSeam.
// Why: Validate optional provider behavior only when both the owner flag and API key are present.
// Info flow: process.env gate -> narrow provider config -> live seam adapter -> assertions.
import { describe, expect, it } from 'vitest';
import { createImageProviderConfigSeam } from '../../src/lib/adapters/image-provider-config-seam';
import { createImageGenerationSeam } from '../../src/lib/adapters/image-generation-seam';

const featureEnabled = process.env.FEATURE_INTEGRATION_TESTS === 'true';
const hasApiKey = Boolean(process.env.XAI_API_KEY);
const runPaidProviderTest = featureEnabled && hasApiKey;

describe('ImageGenerationSeam integration', () => {
	it.skipIf(!runPaidProviderTest)(
		'generates an image via xAI and returns a Result when paid integration is explicitly enabled',
		async () => {
			const configSeam = createImageProviderConfigSeam();
			const imageSeam = createImageGenerationSeam(configSeam);
			const result = await imageSeam.generate({
				prompt: 'a bow-wearing kitten in a glam setting',
				negativePrompt: 'color, shading, grayscale',
				n: 1,
				size: '1024x1024',
				format: 'url'
			});

			expect(result.ok).toBe(true);
			if (!result.ok) return;
			expect(result.value.images.length).toBeGreaterThan(0);
			expect(result.value.timingMs).toBeGreaterThan(0);
		}
	);
});
