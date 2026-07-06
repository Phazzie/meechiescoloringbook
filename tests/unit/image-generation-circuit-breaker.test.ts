// Purpose: Contract tests for the ImageGenerationSeam adapter's circuit breaker.
// Why: The breaker is module-scoped (shared across every createImageGenerationSeam(...) call,
//      by design — see src/lib/adapters/image-generation-seam/index.ts), so it lives in its own
//      file and resets the module before each test to start from a fresh, closed breaker instead
//      of inheriting state left over by another test file's import of the same module.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ImageProviderConfigSeam } from '../../src/lib/seams/image-provider-config-seam/contract';
import { imageGenerationRequestFixture } from '../../src/lib/seams/image-generation-seam/fixtures';

const mockConfigSeam: ImageProviderConfigSeam = {
	getConfig: () => ({
		xaiApiKey: 'test-key',
		xaiImageModel: 'grok-imaging-image',
		xaiBaseUrl: 'https://api.x.ai/v1',
		xaiImageEndpointPath: '/images/generations'
	})
};

let fetchMock: ReturnType<typeof vi.fn>;
let createImageGenerationSeam: typeof import('../../src/lib/adapters/image-generation-seam').createImageGenerationSeam;

beforeEach(async () => {
	vi.resetModules();
	({ createImageGenerationSeam } = await import('../../src/lib/adapters/image-generation-seam'));
	fetchMock = vi.fn();
	vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
	vi.unstubAllGlobals();
});

describe('ImageGenerationSeam adapter circuit breaker', () => {
	it('opens after repeated retryable HTTP failures and fails fast without fetching', async () => {
		fetchMock.mockImplementation(
			async () =>
				new Response(JSON.stringify({ error: { message: 'unavailable' } }), {
					status: 503,
					statusText: 'Service Unavailable'
				})
		);
		const seam = createImageGenerationSeam(mockConfigSeam);

		for (let i = 0; i < 3; i++) {
			const output = await seam.generate(imageGenerationRequestFixture);
			expect(output.ok).toBe(false);
		}
		expect(fetchMock).toHaveBeenCalledTimes(3);

		const output = await seam.generate(imageGenerationRequestFixture);
		expect(output.ok).toBe(false);
		if (!output.ok) {
			expect(output.error.code).toBe('IMAGE_CIRCUIT_OPEN');
		}
		expect(fetchMock).toHaveBeenCalledTimes(3);
	});

	it('does not open the breaker when the fetch is aborted', async () => {
		fetchMock.mockImplementation(async () => {
			throw Object.assign(new Error('aborted'), { name: 'AbortError' });
		});
		const seam = createImageGenerationSeam(mockConfigSeam);

		for (let i = 0; i < 3; i++) {
			const output = await seam.generate(imageGenerationRequestFixture);
			expect(output.ok).toBe(false);
		}

		// If the prior aborted calls had tripped the breaker, this 4th call would short-circuit
		// with IMAGE_CIRCUIT_OPEN instead of reaching fetch again.
		await seam.generate(imageGenerationRequestFixture);
		expect(fetchMock).toHaveBeenCalledTimes(4);
	});

	it('records a breaker failure when reading a non-retryable HTTP error body times out', async () => {
		fetchMock.mockImplementation(async () => ({
			status: 400,
			ok: false,
			text: () => Promise.reject(Object.assign(new Error('timed out'), { name: 'TimeoutError' }))
		}));
		const seam = createImageGenerationSeam(mockConfigSeam);

		for (let i = 0; i < 3; i++) {
			const output = await seam.generate(imageGenerationRequestFixture);
			expect(output.ok).toBe(false);
			if (!output.ok) {
				expect(output.error.code).toBe('IMAGE_TIMEOUT_ERROR');
			}
		}

		// A stalled body read on a non-retryable status is still genuine evidence of upstream
		// trouble and must count toward the breaker — a 4th call should short-circuit with
		// IMAGE_CIRCUIT_OPEN instead of reaching fetch again.
		const output = await seam.generate(imageGenerationRequestFixture);
		expect(output.ok).toBe(false);
		if (!output.ok) {
			expect(output.error.code).toBe('IMAGE_CIRCUIT_OPEN');
		}
		expect(fetchMock).toHaveBeenCalledTimes(3);
	});

	it('records a breaker failure (not a swallowed success) when a non-retryable error body read fails with a generic network error', async () => {
		fetchMock.mockImplementation(async () => ({
			status: 400,
			ok: false,
			text: () => Promise.reject(new Error('socket hang up'))
		}));
		const seam = createImageGenerationSeam(mockConfigSeam);

		for (let i = 0; i < 3; i++) {
			const output = await seam.generate(imageGenerationRequestFixture);
			expect(output.ok).toBe(false);
			if (!output.ok) {
				expect(output.error.code).toBe('IMAGE_NETWORK_ERROR');
			}
		}

		// A dropped connection while reading a non-retryable error body is genuine evidence of
		// upstream trouble and must count toward the breaker, not be silently swallowed into a
		// success — a 4th call should short-circuit with IMAGE_CIRCUIT_OPEN instead of fetching.
		const output = await seam.generate(imageGenerationRequestFixture);
		expect(output.ok).toBe(false);
		if (!output.ok) {
			expect(output.error.code).toBe('IMAGE_CIRCUIT_OPEN');
		}
		expect(fetchMock).toHaveBeenCalledTimes(3);
	});

	it('records a breaker failure (not a false parse_error success) when response.json() throws a non-SyntaxError', async () => {
		fetchMock.mockImplementation(async () => ({
			status: 200,
			ok: true,
			json: () => Promise.reject(new Error('stream terminated unexpectedly'))
		}));
		const seam = createImageGenerationSeam(mockConfigSeam);

		for (let i = 0; i < 3; i++) {
			const output = await seam.generate(imageGenerationRequestFixture);
			expect(output.ok).toBe(false);
			if (!output.ok) {
				expect(output.error.code).toBe('IMAGE_NETWORK_ERROR');
			}
		}

		// A stream error while reading a 2xx body is genuine evidence of upstream trouble, not a
		// reachable-but-malformed JSON payload — it must count toward the breaker instead of being
		// misclassified as a parse_error success; a 4th call should short-circuit.
		const output = await seam.generate(imageGenerationRequestFixture);
		expect(output.ok).toBe(false);
		if (!output.ok) {
			expect(output.error.code).toBe('IMAGE_CIRCUIT_OPEN');
		}
		expect(fetchMock).toHaveBeenCalledTimes(3);
	});

	it('records a breaker success on HTTP 200 even when the response has no images', async () => {
		fetchMock.mockImplementation(
			async () =>
				new Response(JSON.stringify({ data: [] }), {
					status: 200,
					headers: { 'Content-Type': 'application/json' }
				})
		);
		const seam = createImageGenerationSeam(mockConfigSeam);

		for (let i = 0; i < 3; i++) {
			const output = await seam.generate(imageGenerationRequestFixture);
			expect(output.ok).toBe(false);
			if (!output.ok) {
				expect(output.error.code).toBe('IMAGE_EMPTY_RESPONSE');
			}
		}

		// An empty-images response on a 200 status must not count toward the breaker — a 4th
		// call should still reach fetch instead of short-circuiting with IMAGE_CIRCUIT_OPEN.
		await seam.generate(imageGenerationRequestFixture);
		expect(fetchMock).toHaveBeenCalledTimes(4);
	});
});
