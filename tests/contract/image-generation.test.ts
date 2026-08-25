// Purpose: Contract tests for ImageGenerationSeam using fixture-backed mocks.
// Why: Ensure xAI-backed image generation returns contract-compliant results.
// Info flow: Fixtures -> mock/adapter -> assertions.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createMockImageGenerationSeam } from '../../src/lib/seams/image-generation-seam/mock';
import { createImageGenerationSeam } from '../../src/lib/adapters/image-generation-seam';
import { IMAGE_MODEL, TEXT_MODEL } from '../../src/lib/core/models';
import type { AppConfigSeam } from '../../src/lib/seams/app-config-seam/contract';
import {
	imageGenerationRequestFixture,
	imageGenerationFaultFixture
} from '../../src/lib/seams/image-generation-seam/fixtures';
import { ImageGenerationInputSchema } from '../../contracts/image-generation.contract';
import promptBoundaryLiveRequest from '../../docs/evidence/2026-08-25/prompt-boundary-live-request.json';

const mockConfigSeam: AppConfigSeam = {
	getConfig: () => ({
		xaiApiKey: 'test-key',
		xaiTextModel: TEXT_MODEL,
		xaiImageModel: IMAGE_MODEL,
		xaiBaseUrl: 'https://api.x.ai/v1',
		xaiImageEndpointPath: '/images/generations',
		featureIntegrationTests: false,
		maxImagesPerRequest: 4,
		defaultImageSize: '1024x1024',
		geminiApiKey: 'test-gemini-key',
		geminiBaseUrl: 'https://generativelanguage.googleapis.com'
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

describe('ImageGenerationSeam contract', () => {
	it('keeps the documented prompt-boundary replay request schema-valid', () => {
		expect(() => ImageGenerationInputSchema.parse(promptBoundaryLiveRequest)).not.toThrow();
	});

	it('mock returns sample fixture output', async () => {
		const mock = createMockImageGenerationSeam('sample');
		const output = await mock.generate(imageGenerationRequestFixture);
		expect(output.ok).toBe(true);
	});

	it('mock returns fault fixture output', async () => {
		const mock = createMockImageGenerationSeam('fault');
		const output = await mock.generate(imageGenerationRequestFixture);
		expect(output.ok).toBe(false);
		if (!output.ok) {
			expect(output.error.code).toBe(imageGenerationFaultFixture.code);
		}
	});

	it('adapter returns IMAGE_HTTP_ERROR when xAI responds with an HTTP failure', async () => {
		fetchMock.mockResolvedValueOnce(
			new Response('rate limited', {
				status: 429,
				statusText: 'Too Many Requests'
			})
		);
		const seam = createImageGenerationSeam(mockConfigSeam);
		const output = await seam.generate(imageGenerationRequestFixture);

		expect(output.ok).toBe(false);
		if (!output.ok) {
			expect(output.error.code).toBe('IMAGE_HTTP_ERROR');
			if (output.error.code === 'IMAGE_HTTP_ERROR') {
				expect(output.error.details?.status).toBe('429');
			}
		}
		expect(fetchMock).toHaveBeenCalledOnce();
	});

	it('adapter returns IMAGE_ABORTED without fetching when caller signal is already aborted', async () => {
		const controller = new AbortController();
		controller.abort();
		const seam = createImageGenerationSeam(mockConfigSeam);
		const output = await seam.generate({
			...imageGenerationRequestFixture,
			signal: controller.signal
		} as typeof imageGenerationRequestFixture);

		expect(output.ok).toBe(false);
		if (!output.ok) {
			expect(output.error.code).toBe('IMAGE_ABORTED');
		}
		expect(fetchMock).not.toHaveBeenCalled();
	});

	it('adapter returns IMAGE_TIMEOUT_ERROR when xAI response body parsing times out', async () => {
		const timeout = Object.assign(new Error('body read timed out'), { name: 'TimeoutError' });
		fetchMock.mockResolvedValueOnce({
			ok: true,
			status: 200,
			json: vi.fn().mockRejectedValue(timeout)
		} as unknown as Response);
		const seam = createImageGenerationSeam(mockConfigSeam);
		const output = await seam.generate(imageGenerationRequestFixture);

		expect(output.ok).toBe(false);
		if (!output.ok) {
			expect(output.error.code).toBe('IMAGE_TIMEOUT_ERROR');
			expect(output.error.message).toContain('timed out');
		}
		expect(fetchMock).toHaveBeenCalledOnce();
	});

	it('adapter returns ok result with images from xAI response', async () => {
		const seam = createImageGenerationSeam(mockConfigSeam);
		const output = await seam.generate(imageGenerationRequestFixture);
		expect(output.ok).toBe(true);
		if (output.ok) {
			expect(output.value.images).toHaveLength(1);
			expect(output.value.images[0].url).toBe('https://example.com/image.png');
		}
		expect(fetchMock).toHaveBeenCalledOnce();
	});

	it('adapter returns error for invalid prompt (validation)', async () => {
		const seam = createImageGenerationSeam(mockConfigSeam);
		// Empty prompt triggers IMAGE_VALIDATION_ERROR before fetch is called.
		const output = await seam.generate({
			...imageGenerationRequestFixture,
			prompt: ''
		});
		expect(output.ok).toBe(false);
		if (!output.ok) {
			expect(output.error.code).toBe('IMAGE_VALIDATION_ERROR');
		}
		expect(fetchMock).not.toHaveBeenCalled();
	});
});
