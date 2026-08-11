/*
 * Purpose: Unit tests for validateImageGenerationRequest from the image-generation seam.
 * Why: Ensure the validator rejects bad inputs and accepts valid ones per the schema contract.
 * Info flow: Test inputs -> validateImageGenerationRequest -> parsed value or thrown ZodError.
 */
import { describe, expect, it } from 'vitest';
import { validateImageGenerationRequest } from '../../src/lib/seams/image-generation-seam/validators';

const validRequest = {
	prompt: 'a glam kitten wearing a bow',
	n: 2,
	aspectRatio: '3:4',
	resolution: '2k',
	format: 'url'
};

describe('validateImageGenerationRequest', () => {
	it('accepts a valid request with all required fields', () => {
		const result = validateImageGenerationRequest(validRequest);
		expect(result.prompt).toBe('a glam kitten wearing a bow');
		expect(result.n).toBe(2);
		expect(result.aspectRatio).toBe('3:4');
		expect(result.resolution).toBe('2k');
		expect(result.format).toBe('url');
	});

	it('accepts a valid request with all optional fields present', () => {
		const result = validateImageGenerationRequest({
			...validRequest,
			negativePrompt: 'no color',
			seed: 42,
			userTag: 'test-user'
		});
		expect(result.negativePrompt).toBe('no color');
		expect(result.seed).toBe(42);
		expect(result.userTag).toBe('test-user');
	});

	it('accepts a valid request when all optional fields are absent', () => {
		const result = validateImageGenerationRequest(validRequest);
		expect(result.negativePrompt).toBeUndefined();
		expect(result.seed).toBeUndefined();
		expect(result.userTag).toBeUndefined();
	});

	it('throws when prompt is an empty string', () => {
		expect(() =>
			validateImageGenerationRequest({ ...validRequest, prompt: '' })
		).toThrow();
	});

	it('throws when n is 0 (below min of 1)', () => {
		expect(() =>
			validateImageGenerationRequest({ ...validRequest, n: 0 })
		).toThrow();
	});

	it('throws when n is 11 (above max of 10)', () => {
		expect(() =>
			validateImageGenerationRequest({ ...validRequest, n: 11 })
		).toThrow();
	});

	it('throws when format is an invalid enum value', () => {
		expect(() =>
			validateImageGenerationRequest({ ...validRequest, format: 'jpeg' })
		).toThrow();
	});

	it('throws when aspectRatio is missing', () => {
		const { aspectRatio: _aspectRatio, ...withoutAspectRatio } = validRequest;
		expect(() => validateImageGenerationRequest(withoutAspectRatio)).toThrow();
	});

	it('accepts format b64_json as a valid enum value', () => {
		const result = validateImageGenerationRequest({ ...validRequest, format: 'b64_json' });
		expect(result.format).toBe('b64_json');
	});
});
