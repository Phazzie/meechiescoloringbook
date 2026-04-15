// Purpose: Unit tests for image-generation-pipeline edge cases.
// Why: Ensure prompt phrase validation, provider error handling, and image extraction work correctly.
// Info flow: Pipeline inputs -> function logic -> verified responses.
import { describe, expect, it, vi } from 'vitest';
import { runImageGenerationPipeline } from '../../src/lib/core/image-generation-pipeline';

const validSpec = {
	title: 'Dream Big',
	items: [
		{ number: 1, label: 'Shine' },
		{ number: 2, label: 'Grow' }
	],
	listMode: 'list',
	alignment: 'left',
	numberAlignment: 'strict',
	listGutter: 'normal',
	whitespaceScale: 50,
	textSize: 'small',
	fontStyle: 'rounded',
	textStrokeWidth: 6,
	colorMode: 'black_and_white_only',
	decorations: 'none',
	illustrations: 'none',
	shading: 'none',
	border: 'plain',
	borderThickness: 8,
	variations: 1,
	outputFormat: 'pdf',
	pageSize: 'US_Letter'
} as const;

const validPrompt = [
	'Black-and-white coloring book page',
	'outline-only',
	'easy to color',
	'Crisp vector-like linework',
	'NEGATIVE PROMPT:',
	'US Letter 8.5x11 portrait.'
].join(' ');

describe('image-generation-pipeline edge cases', () => {
	it('rejects invalid input', async () => {
		const result = await runImageGenerationPipeline(
			{ spec: {} },
			{ createProvider: vi.fn() }
		);
		expect(result.status).toBe(400);
		expect(result.body.ok).toBe(false);
		if (!result.body.ok) {
			expect(result.body.error.code).toBe('IMAGE_INPUT_INVALID');
		}
	});

	it('rejects prompt missing required phrases', async () => {
		const result = await runImageGenerationPipeline(
			{
				spec: validSpec,
				prompt: 'A simple coloring page',
				variations: 1,
				outputFormat: 'pdf'
			},
			{ createProvider: vi.fn() }
		);
		expect(result.status).toBe(400);
		expect(result.body.ok).toBe(false);
		if (!result.body.ok) {
			expect(result.body.error.code).toBe('PROMPT_MISSING_REQUIRED_PHRASES');
		}
	});

	it('returns 401 when provider API key is missing', async () => {
		const result = await runImageGenerationPipeline(
			{
				spec: validSpec,
				prompt: validPrompt,
				variations: 1,
				outputFormat: 'pdf'
			},
			{
				createProvider: vi.fn().mockReturnValue({
					createChatCompletion: vi.fn(),
					createImageGeneration: vi.fn().mockResolvedValue({
						ok: false,
						error: { code: 'PROVIDER_API_KEY_MISSING', message: 'Key required' }
					})
				})
			}
		);
		expect(result.status).toBe(401);
		expect(result.body.ok).toBe(false);
		if (!result.body.ok) {
			expect(result.body.error.code).toBe('PROVIDER_API_KEY_MISSING');
			expect(result.body.error.message).toContain('XAI_API_KEY');
		}
	});

	it('returns 502 when provider returns non-key error', async () => {
		const result = await runImageGenerationPipeline(
			{
				spec: validSpec,
				prompt: validPrompt,
				variations: 1,
				outputFormat: 'pdf'
			},
			{
				createProvider: vi.fn().mockReturnValue({
					createChatCompletion: vi.fn(),
					createImageGeneration: vi.fn().mockResolvedValue({
						ok: false,
						error: { code: 'PROVIDER_HTTP_ERROR', message: 'Service unavailable' }
					})
				})
			}
		);
		expect(result.status).toBe(502);
		expect(result.body.ok).toBe(false);
	});

	it('returns error when provider returns images without b64_json', async () => {
		const result = await runImageGenerationPipeline(
			{
				spec: validSpec,
				prompt: validPrompt,
				variations: 1,
				outputFormat: 'pdf'
			},
			{
				createProvider: vi.fn().mockReturnValue({
					createChatCompletion: vi.fn(),
					createImageGeneration: vi.fn().mockResolvedValue({
						ok: true,
						value: {
							images: [{ url: 'https://example.com/img.png' }],
							revisedPrompt: 'revised'
						}
					})
				})
			}
		);
		expect(result.status).toBe(502);
		expect(result.body.ok).toBe(false);
		if (!result.body.ok) {
			expect(result.body.error.code).toBe('PROVIDER_EMPTY_IMAGE');
		}
	});

	it('succeeds with valid b64_json images', async () => {
		const result = await runImageGenerationPipeline(
			{
				spec: validSpec,
				prompt: validPrompt,
				variations: 1,
				outputFormat: 'pdf'
			},
			{
				createProvider: vi.fn().mockReturnValue({
					createChatCompletion: vi.fn(),
					createImageGeneration: vi.fn().mockResolvedValue({
						ok: true,
						value: {
							images: [{ b64_json: 'abc123' }],
							revisedPrompt: 'revised prompt'
						}
					})
				})
			}
		);
		expect(result.status).toBe(200);
		expect(result.body.ok).toBe(true);
		if (result.body.ok) {
			expect(result.body.value.images).toHaveLength(1);
			expect(result.body.value.images[0].format).toBe('png');
			expect(result.body.value.images[0].encoding).toBe('base64');
			expect(result.body.value.revisedPrompt).toBe('revised prompt');
		}
	});

	it('filters out images without b64_json and keeps valid ones', async () => {
		const result = await runImageGenerationPipeline(
			{
				spec: validSpec,
				prompt: validPrompt,
				variations: 2,
				outputFormat: 'pdf'
			},
			{
				createProvider: vi.fn().mockReturnValue({
					createChatCompletion: vi.fn(),
					createImageGeneration: vi.fn().mockResolvedValue({
						ok: true,
						value: {
							images: [
								{ url: 'https://only-url.png' },
								{ b64_json: 'valid-base64' }
							],
							revisedPrompt: undefined
						}
					})
				})
			}
		);
		expect(result.status).toBe(200);
		expect(result.body.ok).toBe(true);
		if (result.body.ok) {
			expect(result.body.value.images).toHaveLength(1);
			expect(result.body.value.images[0].id).toBe('image-2');
		}
	});

	it('validates A4 page size phrase check', async () => {
		const a4Prompt = [
			'Black-and-white coloring book page',
			'outline-only',
			'easy to color',
			'Crisp vector-like linework',
			'NEGATIVE PROMPT:',
			'A4 8.27x11.69 portrait.'
		].join(' ');

		const a4Spec = { ...validSpec, pageSize: 'A4' as const };

		const result = await runImageGenerationPipeline(
			{
				spec: a4Spec,
				prompt: a4Prompt,
				variations: 1,
				outputFormat: 'pdf'
			},
			{
				createProvider: vi.fn().mockReturnValue({
					createChatCompletion: vi.fn(),
					createImageGeneration: vi.fn().mockResolvedValue({
						ok: true,
						value: {
							images: [{ b64_json: 'data' }],
							revisedPrompt: undefined
						}
					})
				})
			}
		);
		expect(result.status).toBe(200);
		expect(result.body.ok).toBe(true);
	});
});
