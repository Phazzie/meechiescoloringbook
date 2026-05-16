// Purpose: Contract tests for XaiImageProviderSeam using fixture-backed mocks and the live adapter.
// Why: Ensure the xAI image provider seam returns contract-compliant results for both happy and fault paths.
// Info flow: Fixtures -> mock/adapter -> assertions.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createMockImageGenerationSeam } from '../../src/lib/seams/image-generation-seam/mock';
import { createImageGenerationSeam } from '../../src/lib/adapters/image-generation-seam';
import type { ImageProviderConfigSeam } from '../../src/lib/seams/image-provider-config-seam/contract';
import {
	imageGenerationRequestFixture,
	imageGenerationFaultFixture
} from '../../src/lib/seams/image-generation-seam/fixtures';

const mockConfigSeam: ImageProviderConfigSeam = {
	getConfig: () => ({
		xaiApiKey: 'test-key',
		xaiImageModel: 'grok-imaging-image',
		xaiBaseUrl: 'https://api.x.ai/v1',
		xaiImageEndpointPath: '/images/generations'
	})
};

// xAI wire format - the shape the xAI /v1/images/generations endpoint returns.
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

describe('XaiImageProviderSeam contract', () => {
	it('mock returns ok result for sample scenario', async () => {
		const mock = createMockImageGenerationSeam('sample');
		const output = await mock.generate(imageGenerationRequestFixture);
		expect(output.ok).toBe(true);
	});

	it('mock returns failing result for fault scenario', async () => {
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

	it('adapter returns IMAGE_VALIDATION_ERROR for empty prompt before fetch', async () => {
		const seam = createImageGenerationSeam(mockConfigSeam);
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

	it('adapter returns IMAGE_HTTP_ERROR when xAI returns non-2xx', async () => {
		fetchMock.mockResolvedValueOnce(
			new Response('Rate limit exceeded', {
				status: 429,
				headers: { 'Content-Type': 'text/plain' }
			})
		);
		const seam = createImageGenerationSeam(mockConfigSeam);
		const output = await seam.generate(imageGenerationRequestFixture);
		expect(output.ok).toBe(false);
		if (!output.ok) {
			expect(output.error.code).toBe('IMAGE_HTTP_ERROR');
		}
	});

	it('adapter returns IMAGE_EMPTY_RESPONSE when xAI returns no images', async () => {
		fetchMock.mockResolvedValueOnce(
			new Response(JSON.stringify({ data: [] }), {
				status: 200,
				headers: { 'Content-Type': 'application/json' }
			})
		);
		const seam = createImageGenerationSeam(mockConfigSeam);
		const output = await seam.generate(imageGenerationRequestFixture);
		expect(output.ok).toBe(false);
		if (!output.ok) {
			expect(output.error.code).toBe('IMAGE_EMPTY_RESPONSE');
		}
	});
});
