// Purpose: Contract tests for ImageGenerationSeam adapter using a stubbed fetch.
// Why: Verify the adapter correctly maps xAI wire responses to the seam contract.
// Info flow: stubbed fetch -> createImageGenerationSeam -> contract assertions.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createImageGenerationSeam } from '../../src/lib/adapters/image-generation-seam';
import type { AppConfigSeam } from '../../src/lib/seams/app-config-seam/contract';
import {
	imageGenerationRequestFixture,
	imageGenerationFaultFixture
} from '../../src/lib/seams/image-generation-seam/fixtures';

const mockConfigSeam: AppConfigSeam = {
	getConfig: () => ({
		xaiApiKey: 'test-key',
		xaiTextModel: 'grok-4-1-fast-reasoning',
		xaiImageModel: 'grok-imaging-image',
		xaiBaseUrl: 'https://api.x.ai/v1',
		xaiImageEndpointPath: '/images/generations',
		featureIntegrationTests: false,
		maxImagesPerRequest: 4,
		defaultImageSize: '1024x1024',
		geminiApiKey: 'test-gemini-key',
		geminiBaseUrl: 'https://generativelanguage.googleapis.com/v1beta'
	})
};

// xAI wire format — the shape the xAI /v1/images/generations endpoint returns.
const xaiSampleResponse = {
	data: [
		{
			url: 'https://example.com/image.png',
			b64_json: null,
			revised_prompt: 'a test image'
		}
	]
};

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
	fetchMock = vi.fn(async () => {
		return new Response(JSON.stringify(xaiSampleResponse), {
			status: 200,
			headers: { 'Content-Type': 'application/json' }
		});
	});
	vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
	vi.unstubAllGlobals();
});

describe('ImageGenerationSeam adapter contract', () => {
	it('returns ok result with images from xAI response', async () => {
		const seam = createImageGenerationSeam(mockConfigSeam);
		const output = await seam.generate(imageGenerationRequestFixture);
		expect(output.ok).toBe(true);
		if (output.ok) {
			expect(output.value.images).toHaveLength(1);
			expect(output.value.images[0].url).toBe('https://example.com/image.png');
		}
		expect(fetchMock).toHaveBeenCalledOnce();
	});

	it('returns error for invalid prompt (validation)', async () => {
		const seam = createImageGenerationSeam(mockConfigSeam);
		// Empty prompt triggers IMAGE_VALIDATION_ERROR before fetch is called.
		const output = await seam.generate({ ...imageGenerationRequestFixture, prompt: '' });
		expect(output.ok).toBe(false);
		if (!output.ok) {
			expect(output.error.code).toBe('IMAGE_VALIDATION_ERROR');
		}
		expect(fetchMock).not.toHaveBeenCalled();
	});

	it('returns IMAGE_HTTP_ERROR when fetch fails', async () => {
		fetchMock.mockResolvedValue(
			new Response('Server Error', { status: 500 })
		);
		const seam = createImageGenerationSeam(mockConfigSeam);
		const output = await seam.generate(imageGenerationRequestFixture);
		expect(output.ok).toBe(false);
		if (!output.ok) {
			expect(output.error.code).toBe(imageGenerationFaultFixture.code);
		}
		expect(fetchMock).toHaveBeenCalledOnce();
	});
});
