// Purpose: Verify /api/generate orchestrates prompt, image, and drift flow for the UI.
// Why: Keep the main generation path on one server endpoint with contract-checked output.
// Info flow: Generate request -> endpoint orchestration -> contract response.
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('$lib/adapters/image-generation-seam', () => ({
	createImageGenerationSeam: vi.fn()
}));

import { createImageGenerationSeam } from '$lib/adapters/image-generation-seam';
import { runGeneratePipeline } from '../../src/lib/core/generate-pipeline';
import { POST } from '../../src/routes/api/generate/+server';

const providerLeakCanary =
	'RAW_PROVIDER_BODY https://api.x.ai/v1/responses?key=xai-secret-canary 550e8400-e29b-41d4-a716-446655440000 account=acct-canary team=team-canary';

const expectProviderLeakCanaryRedacted = (payload: unknown): void => {
	const serialized = JSON.stringify(payload);
	expect(serialized).not.toContain('RAW_PROVIDER_BODY');
	expect(serialized).not.toContain(
		'https://api.x.ai/v1/responses?key=xai-secret-canary'
	);
	expect(serialized).not.toContain('xai-secret-canary');
	expect(serialized).not.toContain('550e8400-e29b-41d4-a716-446655440000');
	expect(serialized).not.toContain('acct-canary');
	expect(serialized).not.toContain('team-canary');
};

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

const buildEvent = (
	body: unknown,
	fetchImpl: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>
): Parameters<typeof POST>[0] =>
	({
		request: new Request('http://localhost/api/generate', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(body)
		}),
		fetch: fetchImpl
	}) as Parameters<typeof POST>[0];

const buildRawEvent = (
	rawBody: string,
	fetchImpl: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>
): Parameters<typeof POST>[0] =>
	({
		request: new Request('http://localhost/api/generate', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: rawBody
		}),
		fetch: fetchImpl
	}) as Parameters<typeof POST>[0];

const assembledPrompt = [
	'Black-and-white coloring book page',
	'outline-only',
	'easy to color',
	'Crisp vector-like linework',
	'NEGATIVE PROMPT:',
	'US Letter 8.5x11 portrait.'
].join(' ');

const buildPipelineDeps = (
	generateImageImpl: (
		body: unknown
	) => Promise<{ status: number; body: unknown }>
): Parameters<typeof runGeneratePipeline>[1] & {
	fetchImpl: ReturnType<typeof vi.fn>;
	checkContentSafety: ReturnType<typeof vi.fn>;
	generateImage: ReturnType<typeof vi.fn>;
} => {
	const fetchImpl = vi.fn(async () => {
		throw new Error('internal image-generation fetch should not be used');
	});
	const checkContentSafety = vi.fn(() => ({ ok: true as const }));
	const generateImage = vi.fn(generateImageImpl);

	return {
		fetchImpl,
		checkContentSafety,
		generateImage,
		validateSpec: vi.fn(async () => ({ ok: true, issues: [] })),
		assemblePrompt: vi.fn(async () => ({
			ok: true,
			value: { prompt: assembledPrompt, templateVersion: 'test-template' }
		})),
		detectDrift: vi.fn(async () => ({
			ok: true,
			value: { violations: [], confidenceScore: 1, recommendedFixes: [] }
		}))
	} as Parameters<typeof runGeneratePipeline>[1] & {
		fetchImpl: ReturnType<typeof vi.fn>;
		checkContentSafety: ReturnType<typeof vi.fn>;
		generateImage: ReturnType<typeof vi.fn>;
	};
};

describe('/api/generate', () => {
	afterEach(() => {
		vi.unstubAllGlobals();
		vi.mocked(createImageGenerationSeam).mockReset();
	});

	it('rejects malformed JSON with INVALID_JSON code', async () => {
		const fetchMock = vi.fn(async () => new Response('{}', { status: 500 }));
		const response = await POST(buildRawEvent('{not: valid json}', fetchMock));
		const payload = await response.json();

		expect(response.status).toBe(400);
		expect(payload.ok).toBe(false);
		expect(payload.error.code).toBe('INVALID_JSON');
		expect(fetchMock).not.toHaveBeenCalled();
	});

	it('rejects invalid payloads', async () => {
		const fetchMock = vi.fn(async () => new Response('{}', { status: 500 }));
		const response = await POST(buildEvent({ spec: {} }, fetchMock));
		const payload = await response.json();

		expect(response.status).toBe(400);
		expect(payload.ok).toBe(false);
		expect(payload.error.code).toBe('GENERATE_INPUT_INVALID');
		expect(fetchMock).not.toHaveBeenCalled();
	});

	it('returns orchestrated generation output without fetching the sibling route', async () => {
		const deps = buildPipelineDeps(async () => ({
			status: 200,
			body: {
				ok: true,
				value: {
					images: [
						{
							id: 'image-1',
							format: 'png',
							mimeType: 'image/png',
							data: 'abc123',
							encoding: 'base64'
						}
					],
					revisedPrompt: 'black and white revised prompt',
					modelMetadata: {
						provider: 'xai',
						model: 'grok-imagine-image'
					}
				}
			}
		}));

		const result = await runGeneratePipeline(
			{
				spec: validSpec,
				styleHint: 'glam sparkle icons'
			},
			deps
		);

		expect(result.status).toBe(200);
		expect(result.body.ok).toBe(true);
		if (result.body.ok) {
			expect(result.body.value.prompt).toBe(assembledPrompt);
			expect(result.body.value.images).toHaveLength(1);
			expect(Array.isArray(result.body.value.violations)).toBe(true);
			expect(Array.isArray(result.body.value.recommendedFixes)).toBe(true);
		}
		expect(deps.fetchImpl).not.toHaveBeenCalled();
		expect(deps.generateImage).toHaveBeenCalledOnce();
		expect(deps.generateImage.mock.calls[0]?.[0]).toEqual({
			spec: validSpec,
			prompt: assembledPrompt,
			variations: validSpec.variations,
			outputFormat: validSpec.outputFormat
		});
	});

	it('returns a content policy violation before image generation when safety fails', async () => {
		const deps = buildPipelineDeps(async () => {
			throw new Error('image generation should not be called');
		});
		deps.checkContentSafety.mockReturnValue({
			ok: false,
			error: {
				code: 'DISALLOWED_CONTENT',
				message: 'Generate request contains disallowed content.',
				details: ['Field: styleHint']
			}
		});

		const result = await runGeneratePipeline(
			{
				spec: validSpec,
				styleHint: 'self-harm scene'
			},
			deps
		);

		expect(result.status).toBe(400);
		expect(result.body.ok).toBe(false);
		if (!result.body.ok) {
			expect(result.body.error.code).toBe('CONTENT_POLICY_VIOLATION');
			expect(result.body.error.details?.policyCode).toBe('DISALLOWED_CONTENT');
			expect(result.body.error.details?.policyDetails).toContain('styleHint');
		}
		expect(deps.validateSpec).not.toHaveBeenCalled();
		expect(deps.generateImage).not.toHaveBeenCalled();
	});

	it('returns an aborted response before expensive seams when caller signal is already aborted', async () => {
		const deps = buildPipelineDeps(async () => {
			throw new Error('image generation should not be called');
		});
		const controller = new AbortController();
		controller.abort();

		const result = await runGeneratePipeline(
			{
				spec: validSpec,
				styleHint: 'glam sparkle icons'
			},
			{
				...deps,
				signal: controller.signal
			} as Parameters<typeof runGeneratePipeline>[1]
		);

		expect(result.status).toBe(499);
		expect(result.body.ok).toBe(false);
		if (!result.body.ok) {
			expect(result.body.error.code).toBe('GENERATE_ABORTED');
		}
		expect(deps.checkContentSafety).not.toHaveBeenCalled();
		expect(deps.validateSpec).not.toHaveBeenCalled();
		expect(deps.generateImage).not.toHaveBeenCalled();
	});

	it('passes caller signal into the image-generation dependency', async () => {
		const controller = new AbortController();
		const deps = buildPipelineDeps(async () => ({
			status: 200,
			body: {
				ok: true,
				value: {
					images: [
						{
							id: 'image-1',
							format: 'png',
							mimeType: 'image/png',
							data: 'abc123',
							encoding: 'base64'
						}
					],
					modelMetadata: {
						provider: 'xai',
						model: 'grok-imagine-image'
					}
				}
			}
		}));

		await runGeneratePipeline(
			{
				spec: validSpec,
				styleHint: 'glam sparkle icons'
			},
			{
				...deps,
				signal: controller.signal
			} as Parameters<typeof runGeneratePipeline>[1]
		);

		expect(deps.generateImage).toHaveBeenCalledWith(
			{
				spec: validSpec,
				prompt: assembledPrompt,
				variations: validSpec.variations,
				outputFormat: validSpec.outputFormat
			},
			controller.signal
		);
	});

	it('preserves typed image-generation failures', async () => {
		const deps = buildPipelineDeps(async () => ({
			status: 503,
			body: {
				ok: false,
				error: {
					code: 'IMAGE_CONFIG_ERROR',
					message: 'Missing image provider key'
				}
			}
		}));

		const result = await runGeneratePipeline({ spec: validSpec }, deps);

		expect(result.status).toBe(503);
		expect(result.body.ok).toBe(false);
		if (!result.body.ok) {
			expect(result.body.error.code).toBe('IMAGE_CONFIG_ERROR');
			expect(result.body.error.message).toBe(
				'Image generation is temporarily unavailable.'
			);
			expect(result.body.error.details).toBeUndefined();
		}
		expect(deps.fetchImpl).not.toHaveBeenCalled();
	});

	it('rejects invalid image-generation pipeline bodies', async () => {
		const deps = buildPipelineDeps(async () => ({
			status: 200,
			body: { ok: true, value: { images: [{ id: '' }] } }
		}));

		const result = await runGeneratePipeline({ spec: validSpec }, deps);

		expect(result.status).toBe(502);
		expect(result.body.ok).toBe(false);
		if (!result.body.ok) {
			expect(result.body.error.code).toBe('IMAGE_RESPONSE_INVALID');
		}
		expect(deps.fetchImpl).not.toHaveBeenCalled();
	});

	it('converts thrown image-generation exceptions into contract errors', async () => {
		const deps = buildPipelineDeps(async () => {
			throw new Error('adapter exploded');
		});

		const result = await runGeneratePipeline({ spec: validSpec }, deps);

		expect(result.status).toBe(502);
		expect(result.body.ok).toBe(false);
		if (!result.body.ok) {
			expect(result.body.error.code).toBe('IMAGE_GENERATION_FAILED');
			expect(result.body.error.message).toBe(
				'Image generation failed unexpectedly.'
			);
			expect(result.body.error.details).toBeUndefined();
		}
		expect(deps.fetchImpl).not.toHaveBeenCalled();
	});

	it('classifies thrown image-generation timeouts as 504 contract errors', async () => {
		const deps = buildPipelineDeps(async () => {
			const timeout = new Error('provider request timed out');
			timeout.name = 'TimeoutError';
			throw timeout;
		});

		const result = await runGeneratePipeline({ spec: validSpec }, deps);

		expect(result.status).toBe(504);
		expect(result.body.ok).toBe(false);
		if (!result.body.ok) {
			expect(result.body.error.code).toBe('IMAGE_GENERATION_TIMEOUT');
			expect(result.body.error.message).toBe('Image generation timed out.');
			expect(result.body.error.details).toBeUndefined();
		}
		expect(deps.fetchImpl).not.toHaveBeenCalled();
	});

	it('keeps the endpoint parse and input guards transport-thin', async () => {
		vi.mocked(createImageGenerationSeam).mockReturnValue({
			generate: vi.fn(async () => ({
				ok: true as const,
				value: {
					images: [{ id: 'xai-1', b64: 'iVBORw0KGgo=' }],
					rawModelInfo: { model: 'grok-imagine-image' },
					timingMs: 1
				}
			}))
		});
		const providerFetchMock = vi.fn(
			async () =>
				new Response(JSON.stringify({ data: [{ b64_json: 'aGVsbG8=' }] }), {
					status: 200,
					headers: { 'Content-Type': 'application/json' }
				})
		);
		// POST destructures only `request`; the image adapter uses global fetch. Stub that
		// boundary so this unit test cannot issue a live xAI request and retry until timeout.
		vi.stubGlobal('fetch', providerFetchMock);
		const fetchMock = vi.fn(
			async () =>
				new Response(
					JSON.stringify({
						ok: true,
						value: {
							images: [
								{
									id: 'image-1',
									format: 'png',
									mimeType: 'image/png',
									data: 'abc123',
									encoding: 'base64'
								}
							],
							revisedPrompt: 'black and white revised prompt',
							modelMetadata: {
								provider: 'xai',
								model: 'grok-imagine-image'
							}
						}
					}),
					{
						status: 200,
						headers: { 'Content-Type': 'application/json' }
					}
				)
		);

		const response = await POST(
			buildEvent(
				{
					spec: validSpec,
					styleHint: 'glam sparkle icons'
				},
				fetchMock
			)
		);
		const payload = await response.json();

		expect(response.status).not.toBe(400);
		expect(payload.error?.code).not.toBe('GENERATE_INPUT_INVALID');
		expect(fetchMock).not.toHaveBeenCalledWith(
			'/api/image-generation',
			expect.objectContaining({ method: 'POST' })
		);
	});

	it('rejects unsafe style hints at the endpoint before image generation', async () => {
		const fetchMock = vi.fn(async () => new Response('{}', { status: 500 }));
		const response = await POST(
			buildEvent(
				{
					spec: validSpec,
					styleHint: 'self-harm scene'
				},
				fetchMock
			)
		);
		const payload = await response.json();

		expect(response.status).toBe(400);
		expect(payload.ok).toBe(false);
		expect(payload.error.code).toBe('CONTENT_POLICY_VIOLATION');
		expect(payload.error.details.policyDetails).toContain('styleHint');
		expect(fetchMock).not.toHaveBeenCalled();
	});

	it('does not serialize upstream provider diagnostics at the endpoint', async () => {
		vi.mocked(createImageGenerationSeam).mockReturnValue({
			generate: vi.fn(async () => ({
				ok: false as const,
				error: {
					code: 'IMAGE_HTTP_ERROR' as const,
					message: providerLeakCanary,
					details: {
						body: providerLeakCanary,
						accountId: 'acct-canary',
						teamId: 'team-canary'
					}
				}
			}))
		});
		const fetchMock = vi.fn(async () => new Response('{}', { status: 500 }));

		const response = await POST(buildEvent({ spec: validSpec }, fetchMock));
		const payload = await response.json();

		expect(response.status).toBe(502);
		expect(payload.ok).toBe(false);
		expect(payload.error.code).toBe('IMAGE_HTTP_ERROR');
		expectProviderLeakCanaryRedacted(payload);
		expect(fetchMock).not.toHaveBeenCalled();
	});
});
