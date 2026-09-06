// Purpose: Unit tests for pipeline error paths and edge cases.
// Why: Ensure pipelines handle failures in each stage correctly.
// Info flow: Various failure inputs -> pipeline functions -> verified error responses.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { runChatInterpretationPipeline } from '../../src/lib/core/chat-interpretation-pipeline';
import { runToolsPipeline } from '../../src/lib/core/tools-pipeline';
import {
	runGeneratePipeline,
	type GeneratePipelineDeps
} from '../../src/lib/core/generate-pipeline';

// The quota gate is a required dependency on every billable pipeline, deliberately: an
// optional gate is a production bypass. These tests are about error paths, not metering, so
// they inject a gate that always allows and assert nothing about it. The routes' own tests
// cover allow, deny, exhaustion and store failure.
const allowQuota = () =>
	vi.fn().mockResolvedValue({ ok: true as const, headers: {} });

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
				consumeQuota: allowQuota(),
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
				consumeQuota: allowQuota(),
				createChatCompletion: vi.fn().mockResolvedValue({
					ok: false,
					error: {
						code: 'PROVIDER_HTTP_ERROR',
						message: 'Service down',
						details: { status: '429' }
					}
				}),
				validateSpec: vi.fn()
			}
		);
		expect(result.body.ok).toBe(false);
		if (!result.body.ok) {
			expect(result.body.error.code).toBe('PROVIDER_HTTP_ERROR');
			expect(result.body.error.message).toBe('AI provider request failed.');
			expect(result.body.error.details).toBeUndefined();
		}
	});

	it('returns error when chat content has no JSON', async () => {
		const result = await runChatInterpretationPipeline(
			{ message: 'Make me a cool page' },
			{
				consumeQuota: allowQuota(),
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
				consumeQuota: allowQuota(),
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
			expect(['CHAT_RESPONSE_INVALID', 'CHAT_SPEC_INVALID']).toContain(
				result.body.error.code
			);
		}
	});

	it('returns error when non-whitespace text appears before a braced snippet', async () => {
		const result = await runChatInterpretationPipeline(
			{ message: 'Make me a cool page' },
			{
				consumeQuota: allowQuota(),
				createChatCompletion: vi.fn().mockResolvedValue({
					ok: true,
					value: {
						model: 'grok',
						content: 'Narration with braces {not real json snippet}'
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

	it('returns error when response contains multiple JSON objects', async () => {
		const result = await runChatInterpretationPipeline(
			{ message: 'Make me a cool page' },
			{
				consumeQuota: allowQuota(),
				createChatCompletion: vi.fn().mockResolvedValue({
					ok: true,
					value: {
						model: 'grok',
						content: `${JSON.stringify(validSpec)}\n${JSON.stringify(validSpec)}`
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

	it('returns error when response is valid JSON but not an object', async () => {
		const result = await runChatInterpretationPipeline(
			{ message: 'Make me a cool page' },
			{
				consumeQuota: allowQuota(),
				createChatCompletion: vi.fn().mockResolvedValue({
					ok: true,
					value: {
						model: 'grok',
						content: JSON.stringify(['not', 'an', 'object'])
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

	it('returns error when JSON does not match spec schema', async () => {
		const result = await runChatInterpretationPipeline(
			{ message: 'Make me a cool page' },
			{
				consumeQuota: allowQuota(),
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
				consumeQuota: allowQuota(),
				createChatCompletion: vi.fn().mockResolvedValue({
					ok: true,
					value: {
						model: 'grok',
						content: JSON.stringify(validSpec)
					}
				}),
				validateSpec: vi.fn().mockResolvedValue({
					ok: false,
					issues: [
						{
							code: 'SPEC_INVALID',
							field: 'title',
							message: 'Title is too long.'
						}
					]
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
				consumeQuota: allowQuota(),
				createChatCompletion: vi.fn().mockResolvedValue({
					ok: true,
					value: {
						model: 'grok',
						content: JSON.stringify(validSpec)
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
			{ respond: vi.fn(), consumeQuota: allowQuota() }
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
				apology: 'self-harm and minors content'
			},
			{ respond: vi.fn(), consumeQuota: allowQuota() }
		);
		expect(result.status).toBe(400);
		expect(result.body.ok).toBe(false);
		if (!result.body.ok) {
			expect(result.body.error.code).toBe('DISALLOWED_CONTENT');
			expect(result.body.error.details?.keywords).toContain('self-harm');
			expect(result.body.error.details?.keywords).toContain('minors');
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
			{ respond: mockRespond, consumeQuota: allowQuota() }
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
			{ respond: mockRespond, consumeQuota: allowQuota() }
		);
		expect(result.body.ok).toBe(false);
		if (!result.body.ok) {
			expect(result.body.error.code).toBe('MEECHIE_TOOL_OUTPUT_INVALID');
		}
	});
});

describe('generate-pipeline edge cases', () => {
	const imageSuccessBody = {
		ok: true as const,
		value: {
			images: [
				{
					id: 'img-1',
					format: 'png' as const,
					mimeType: 'image/png',
					data: 'abc123',
					encoding: 'base64' as const
				}
			],
			revisedPrompt: 'revised prompt',
			modelMetadata: { provider: 'xai', model: 'grok-imagine-image' }
		}
	};

	const buildGenerateDeps = (
		overrides: Partial<GeneratePipelineDeps> = {}
	): GeneratePipelineDeps => ({
		consumeQuota: allowQuota(),
		checkContentSafety: vi.fn().mockReturnValue({ ok: true as const }),
		validateSpec: vi.fn().mockResolvedValue({ ok: true as const, issues: [] }),
		assemblePrompt: vi.fn().mockResolvedValue({
			ok: true as const,
			value: { prompt: 'assembled prompt', templateVersion: 'v2' }
		}),
		detectDrift: vi.fn().mockResolvedValue({
			ok: true as const,
			value: { violations: [], confidenceScore: 1, recommendedFixes: [] }
		}),
		generateImage: vi.fn().mockResolvedValue({
			status: 200,
			body: imageSuccessBody
		}),
		...overrides
	});

	it('rejects invalid request body', async () => {
		const result = await runGeneratePipeline({ spec: {} }, buildGenerateDeps());
		expect(result.status).toBe(400);
		expect(result.body.ok).toBe(false);
		if (!result.body.ok) {
			expect(result.body.error.code).toBe('GENERATE_INPUT_INVALID');
		}
	});

	it('stops before downstream generation seams when content safety fails', async () => {
		const deps = buildGenerateDeps({
			checkContentSafety: vi.fn().mockReturnValue({
				ok: false,
				error: {
					code: 'DISALLOWED_CONTENT',
					message: 'Generate request contains disallowed content.',
					details: ['Field: styleHint']
				}
			})
		});

		const result = await runGeneratePipeline(
			{ spec: validSpec, styleHint: 'self-harm scene' },
			deps
		);

		expect(result.status).toBe(400);
		expect(result.body.ok).toBe(false);
		if (!result.body.ok) {
			expect(result.body.error.code).toBe('CONTENT_POLICY_VIOLATION');
		}
		expect(deps.validateSpec).not.toHaveBeenCalled();
		expect(deps.assemblePrompt).not.toHaveBeenCalled();
		expect(deps.generateImage).not.toHaveBeenCalled();
	});

	it('returns error when spec validation fails', async () => {
		const result = await runGeneratePipeline(
			{ spec: validSpec },
			{
				...buildGenerateDeps(),
				validateSpec: vi.fn().mockResolvedValue({
					ok: false,
					issues: [
						{
							code: 'SPEC_INVALID',
							field: 'title',
							message: 'Title too short.'
						}
					]
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
				...buildGenerateDeps(),
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
				...buildGenerateDeps(),
				validateSpec: vi.fn().mockResolvedValue({ ok: true, issues: [] }),
				assemblePrompt: vi.fn().mockResolvedValue({
					ok: true,
					value: { prompt: 'test prompt', templateVersion: 'v2' }
				}),
				generateImage: vi.fn().mockResolvedValue({
					status: 200,
					body: { ok: true, value: { images: [{ id: '' }] } }
				})
			}
		);
		expect(result.status).toBe(502);
		expect(result.body.ok).toBe(false);
		if (!result.body.ok) {
			expect(result.body.error.code).toBe('IMAGE_RESPONSE_INVALID');
		}
	});

	it('preserves image pipeline status when image generation returns a typed failure', async () => {
		const result = await runGeneratePipeline(
			{ spec: validSpec },
			{
				...buildGenerateDeps(),
				validateSpec: vi.fn().mockResolvedValue({ ok: true, issues: [] }),
				assemblePrompt: vi.fn().mockResolvedValue({
					ok: true,
					value: { prompt: 'test prompt', templateVersion: 'v2' }
				}),
				generateImage: vi.fn().mockResolvedValue({
					status: 503,
					body: {
						ok: false,
						error: { code: 'IMAGE_HTTP_ERROR', message: 'Provider unavailable' }
					}
				})
			}
		);
		expect(result.status).toBe(503);
		expect(result.body.ok).toBe(false);
		if (!result.body.ok) {
			expect(result.body.error.code).toBe('IMAGE_HTTP_ERROR');
		}
	});

	it('returns error when image generation returns failure result', async () => {
		const result = await runGeneratePipeline(
			{ spec: validSpec },
			{
				...buildGenerateDeps(),
				validateSpec: vi.fn().mockResolvedValue({ ok: true, issues: [] }),
				assemblePrompt: vi.fn().mockResolvedValue({
					ok: true,
					value: { prompt: 'test prompt', templateVersion: 'v2' }
				}),
				generateImage: vi.fn().mockResolvedValue({
					status: 502,
					body: {
						ok: false,
						error: { code: 'PROVIDER_EMPTY_IMAGE', message: 'No images' }
					}
				})
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
			buildGenerateDeps({
				validateSpec: vi.fn().mockResolvedValue({ ok: true, issues: [] }),
				assemblePrompt: vi.fn().mockResolvedValue({
					ok: true,
					value: { prompt: 'assembled prompt', templateVersion: 'v2' }
				}),
				generateImage: vi.fn().mockResolvedValue({
					status: 200,
					body: imageSuccessBody
				}),
				detectDrift: vi.fn().mockResolvedValue({
					ok: true,
					value: { violations: [], confidenceScore: 1, recommendedFixes: [] }
				})
			})
		);
		expect(result.status).toBe(200);
		expect(result.body.ok).toBe(true);
		if (result.body.ok) {
			expect(result.body.value.prompt).toBe('assembled prompt');
			expect(result.body.value.images).toHaveLength(1);
			expect(result.body.value.violations).toEqual([]);
		}
	});

	// Renamed from "includes empty violations when drift detection fails", which is what it used to
	// assert. An empty violation list is how the studio says "nothing wrong with this page", so the
	// old expectation locked in a report that gave its most reassuring answer for the drift seam's
	// most serious finding. This matters more than the name suggests: the seam grades `revisedPrompt`
	// over `promptSent`, and a provider rewrite carries none of the required headings, so a provider
	// discarding the page's constraints took this branch every time and was reported as clean.
	it('reports a failed drift check as a violation rather than as a clean page', async () => {
		const result = await runGeneratePipeline(
			{ spec: validSpec },
			buildGenerateDeps({
				validateSpec: vi.fn().mockResolvedValue({ ok: true, issues: [] }),
				assemblePrompt: vi.fn().mockResolvedValue({
					ok: true,
					value: { prompt: 'assembled prompt', templateVersion: 'v2' }
				}),
				generateImage: vi.fn().mockResolvedValue({
					status: 200,
					body: imageSuccessBody
				}),
				detectDrift: vi.fn().mockResolvedValue({
					ok: false,
					error: { code: 'DRIFT_ERROR', message: 'Detection failed' }
				})
			})
		);
		expect(result.status).toBe(200);
		expect(result.body.ok).toBe(true);
		if (result.body.ok) {
			// `violations` is still empty, and now says why: the seam graded nothing, so it found
			// nothing. `driftCheckFailure` is the field that makes that empty array honest — without
			// it, the seam's most serious outcome and its cleanest one are the same response.
			expect(result.body.value.violations).toEqual([]);
			expect(result.body.value.recommendedFixes).toEqual([]);
			expect(result.body.value.driftCheckFailure).toEqual({
				code: 'DRIFT_ERROR',
				message: 'Detection failed'
			});
		}
	});

	it('omits driftCheckFailure entirely when the drift check did return a verdict', async () => {
		const result = await runGeneratePipeline(
			{ spec: validSpec },
			buildGenerateDeps({
				validateSpec: vi.fn().mockResolvedValue({ ok: true, issues: [] }),
				assemblePrompt: vi.fn().mockResolvedValue({
					ok: true,
					value: { prompt: 'assembled prompt', templateVersion: 'v2' }
				}),
				generateImage: vi.fn().mockResolvedValue({
					status: 200,
					body: imageSuccessBody
				}),
				detectDrift: vi.fn().mockResolvedValue({
					ok: true,
					value: { violations: [], confidenceScore: 1, recommendedFixes: [] }
				})
			})
		);
		expect(result.status).toBe(200);
		expect(result.body.ok).toBe(true);
		if (result.body.ok) {
			// Absent, not `undefined`-valued: its absence is what tells a consumer the empty
			// violation list is a real verdict.
			expect('driftCheckFailure' in result.body.value).toBe(false);
		}
	});
});
