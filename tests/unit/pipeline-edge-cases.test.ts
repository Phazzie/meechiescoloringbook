// Purpose: Unit tests for pipeline error paths and edge cases.
// Why: Ensure pipelines handle failures in each stage correctly.
// Info flow: Various failure inputs -> pipeline functions -> verified error responses.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { runChatInterpretationPipeline } from '../../src/lib/core/chat-interpretation-pipeline';
import { runToolsPipeline } from '../../src/lib/core/tools-pipeline';
import { runGeneratePipeline } from '../../src/lib/core/generate-pipeline';

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

afterEach(() => {
	vi.restoreAllMocks();
});

describe('chat-interpretation-pipeline edge cases', () => {
	it('rejects empty message', async () => {
		const result = await runChatInterpretationPipeline(
			{ message: '' },
			{
				createChatCompletion: vi.fn(),
				validateSpec: vi.fn()
			}
		);
		expect(result.body.ok).toBe(false);
		if (!result.body.ok) {
			expect(result.body.error.code).toBe('CHAT_INPUT_INVALID');
		}
	});

	it('returns error when provider fails', async () => {
		const result = await runChatInterpretationPipeline(
			{ message: 'Make me a cool page' },
			{
				createChatCompletion: vi.fn().mockResolvedValue({
					ok: false,
					error: { code: 'PROVIDER_HTTP_ERROR', message: 'Service down' }
				}),
				validateSpec: vi.fn()
			}
		);
		expect(result.body.ok).toBe(false);
		if (!result.body.ok) {
			expect(result.body.error.code).toBe('PROVIDER_HTTP_ERROR');
		}
	});

	it('returns error when chat content has no JSON', async () => {
		const result = await runChatInterpretationPipeline(
			{ message: 'Make me a cool page' },
			{
				createChatCompletion: vi.fn().mockResolvedValue({
					ok: true,
					value: {
						model: 'grok',
						content: 'Just some text with no JSON at all'
					}
				}),
				validateSpec: vi.fn()
			}
		);
		expect(result.body.ok).toBe(false);
		if (!result.body.ok) {
			expect(result.body.error.code).toBe('CHAT_RESPONSE_INVALID');
		}
	});

	it('returns error when extracted JSON is malformed', async () => {
		const result = await runChatInterpretationPipeline(
			{ message: 'Make me a cool page' },
			{
				createChatCompletion: vi.fn().mockResolvedValue({
					ok: true,
					value: {
						model: 'grok',
						content: 'Here: {not valid json}'
					}
				}),
				validateSpec: vi.fn()
			}
		);
		expect(result.body.ok).toBe(false);
		if (!result.body.ok) {
			expect(['CHAT_RESPONSE_INVALID', 'CHAT_SPEC_INVALID']).toContain(result.body.error.code);
		}
	});

	it('returns error when JSON does not match spec schema', async () => {
		const result = await runChatInterpretationPipeline(
			{ message: 'Make me a cool page' },
			{
				createChatCompletion: vi.fn().mockResolvedValue({
					ok: true,
					value: {
						model: 'grok',
						content: JSON.stringify({ notASpec: true })
					}
				}),
				validateSpec: vi.fn()
			}
		);
		expect(result.body.ok).toBe(false);
		if (!result.body.ok) {
			expect(result.body.error.code).toBe('CHAT_SPEC_INVALID');
		}
	});

	it('returns error when spec validation fails', async () => {
		const result = await runChatInterpretationPipeline(
			{ message: 'Make me a cool page' },
			{
				createChatCompletion: vi.fn().mockResolvedValue({
					ok: true,
					value: {
						model: 'grok',
						content: JSON.stringify(validSpec)
					}
				}),
				validateSpec: vi.fn().mockResolvedValue({
					ok: false,
					issues: [{ code: 'SPEC_INVALID', field: 'title', message: 'Title is too long.' }]
				})
			}
		);
		expect(result.body.ok).toBe(false);
		if (!result.body.ok) {
			expect(result.body.error.code).toBe('CHAT_SPEC_INVALID');
		}
	});

	it('returns valid spec when everything succeeds', async () => {
		const result = await runChatInterpretationPipeline(
			{ message: 'Make me a cool page' },
			{
				createChatCompletion: vi.fn().mockResolvedValue({
					ok: true,
					value: {
						model: 'grok',
						content: `Here is the spec: ${JSON.stringify(validSpec)}`
					}
				}),
				validateSpec: vi.fn().mockResolvedValue({
					ok: true,
					issues: []
				})
			}
		);
		expect(result.body.ok).toBe(true);
		if (result.body.ok) {
			expect(result.body.value.spec.title).toBe('Dream Big');
		}
	});
});

describe('tools-pipeline edge cases', () => {
	it('rejects invalid tool input', async () => {
		const result = await runToolsPipeline(
			{ toolId: 'nonexistent_tool' },
			{ respond: vi.fn() }
		);
		expect(result.body.ok).toBe(false);
		if (!result.body.ok) {
			expect(result.body.error.code).toBe('MEECHIE_TOOL_INPUT_INVALID');
		}
	});

	it('detects multiple disallowed keywords', async () => {
		const result = await runToolsPipeline(
			{
				toolId: 'apology_translator',
				apology: 'sexual and nude content'
			},
			{ respond: vi.fn() }
		);
		expect(result.status).toBe(400);
		expect(result.body.ok).toBe(false);
		if (!result.body.ok) {
			expect(result.body.error.code).toBe('DISALLOWED_CONTENT');
			expect(result.body.error.details?.keywords).toContain('sexual');
			expect(result.body.error.details?.keywords).toContain('nude');
		}
	});

	it('passes safe input to adapter and returns result', async () => {
		const mockRespond = vi.fn().mockResolvedValue({
			ok: true,
			value: {
				toolId: 'apology_translator',
				headline: 'Test',
				response: 'Test response'
			}
		});
		const result = await runToolsPipeline(
			{
				toolId: 'apology_translator',
				apology: 'Sorry not sorry'
			},
			{ respond: mockRespond }
		);
		expect(result.status).toBe(200);
		expect(result.body.ok).toBe(true);
		expect(mockRespond).toHaveBeenCalled();
	});

	it('returns error when adapter output does not match schema', async () => {
		const mockRespond = vi.fn().mockResolvedValue({
			ok: true,
			value: {
				toolId: 'apology_translator',
				headline: '', // empty string fails NonEmptyStringSchema
				response: 'Test'
			}
		});
		const result = await runToolsPipeline(
			{
				toolId: 'apology_translator',
				apology: 'Sorry about that'
			},
			{ respond: mockRespond }
		);
		expect(result.body.ok).toBe(false);
		if (!result.body.ok) {
			expect(result.body.error.code).toBe('MEECHIE_TOOL_OUTPUT_INVALID');
		}
	});
});

describe('generate-pipeline edge cases', () => {
	const baseDeps = {
		fetchImpl: vi.fn(),
		validateSpec: vi.fn(),
		assemblePrompt: vi.fn(),
		detectDrift: vi.fn()
	};

	it('rejects invalid request body', async () => {
		const result = await runGeneratePipeline({ spec: {} }, baseDeps);
		expect(result.status).toBe(400);
		expect(result.body.ok).toBe(false);
		if (!result.body.ok) {
			expect(result.body.error.code).toBe('GENERATE_INPUT_INVALID');
		}
	});

	it('returns error when spec validation fails', async () => {
		const result = await runGeneratePipeline(
			{ spec: validSpec },
			{
				...baseDeps,
				validateSpec: vi.fn().mockResolvedValue({
					ok: false,
					issues: [{ code: 'SPEC_INVALID', field: 'title', message: 'Title too short.' }]
				})
			}
		);
		expect(result.status).toBe(400);
		expect(result.body.ok).toBe(false);
		if (!result.body.ok) {
			expect(result.body.error.code).toBe('SPEC_INVALID');
		}
	});

	it('returns error when prompt assembly fails', async () => {
		const result = await runGeneratePipeline(
			{ spec: validSpec },
			{
				...baseDeps,
				validateSpec: vi.fn().mockResolvedValue({ ok: true, issues: [] }),
				assemblePrompt: vi.fn().mockResolvedValue({
					ok: false,
					error: { code: 'PROMPT_TOO_LONG', message: 'Prompt exceeds limit.' }
				})
			}
		);
		expect(result.status).toBe(400);
		expect(result.body.ok).toBe(false);
		if (!result.body.ok) {
			expect(result.body.error.code).toBe('PROMPT_TOO_LONG');
		}
	});

	it('returns error when image generation response is invalid', async () => {
		const result = await runGeneratePipeline(
			{ spec: validSpec },
			{
				...baseDeps,
				validateSpec: vi.fn().mockResolvedValue({ ok: true, issues: [] }),
				assemblePrompt: vi.fn().mockResolvedValue({
					ok: true,
					value: { prompt: 'test prompt', templateVersion: 'v2' }
				}),
				fetchImpl: vi.fn().mockResolvedValue(
					new Response('not-json', { status: 200 })
				)
			}
		);
		expect(result.status).toBe(502);
		expect(result.body.ok).toBe(false);
		if (!result.body.ok) {
			expect(result.body.error.code).toBe('IMAGE_RESPONSE_INVALID');
		}
	});

	it('returns error when image generation returns failure result', async () => {
		const result = await runGeneratePipeline(
			{ spec: validSpec },
			{
				...baseDeps,
				validateSpec: vi.fn().mockResolvedValue({ ok: true, issues: [] }),
				assemblePrompt: vi.fn().mockResolvedValue({
					ok: true,
					value: { prompt: 'test prompt', templateVersion: 'v2' }
				}),
				fetchImpl: vi.fn().mockResolvedValue(
					new Response(
						JSON.stringify({
							ok: false,
							error: { code: 'PROVIDER_EMPTY_IMAGE', message: 'No images' }
						}),
						{ status: 502 }
					)
				)
			}
		);
		expect(result.body.ok).toBe(false);
		if (!result.body.ok) {
			expect(result.body.error.code).toBe('PROVIDER_EMPTY_IMAGE');
		}
	});

	it('succeeds with valid pipeline flow', async () => {
		const result = await runGeneratePipeline(
			{ spec: validSpec, styleHint: 'sparkle' },
			{
				validateSpec: vi.fn().mockResolvedValue({ ok: true, issues: [] }),
				assemblePrompt: vi.fn().mockResolvedValue({
					ok: true,
					value: { prompt: 'assembled prompt', templateVersion: 'v2' }
				}),
				fetchImpl: vi.fn().mockResolvedValue(
					new Response(
						JSON.stringify({
							ok: true,
							value: {
								images: [
									{
										id: 'img-1',
										format: 'png',
										mimeType: 'image/png',
										data: 'abc123',
										encoding: 'base64'
									}
								],
								revisedPrompt: 'revised prompt',
								modelMetadata: { provider: 'xai', model: 'grok-imagine-image' }
							}
						}),
						{ status: 200 }
					)
				),
				detectDrift: vi.fn().mockResolvedValue({
					ok: true,
					value: { violations: [], confidenceScore: 1, recommendedFixes: [] }
				})
			}
		);
		expect(result.status).toBe(200);
		expect(result.body.ok).toBe(true);
		if (result.body.ok) {
			expect(result.body.value.prompt).toBe('assembled prompt');
			expect(result.body.value.images).toHaveLength(1);
			expect(result.body.value.violations).toEqual([]);
		}
	});

	it('includes empty violations when drift detection fails', async () => {
		const result = await runGeneratePipeline(
			{ spec: validSpec },
			{
				validateSpec: vi.fn().mockResolvedValue({ ok: true, issues: [] }),
				assemblePrompt: vi.fn().mockResolvedValue({
					ok: true,
					value: { prompt: 'assembled prompt', templateVersion: 'v2' }
				}),
				fetchImpl: vi.fn().mockResolvedValue(
					new Response(
						JSON.stringify({
							ok: true,
							value: {
								images: [
									{
										id: 'img-1',
										format: 'png',
										mimeType: 'image/png',
										data: 'abc123',
										encoding: 'base64'
									}
								],
								revisedPrompt: 'revised',
								modelMetadata: { provider: 'xai', model: 'test' }
							}
						}),
						{ status: 200 }
					)
				),
				detectDrift: vi.fn().mockResolvedValue({
					ok: false,
					error: { code: 'DRIFT_ERROR', message: 'Detection failed' }
				})
			}
		);
		expect(result.status).toBe(200);
		expect(result.body.ok).toBe(true);
		if (result.body.ok) {
			expect(result.body.value.violations).toEqual([]);
			expect(result.body.value.recommendedFixes).toEqual([]);
		}
	});
});
