// Purpose: Contract tests for ProviderAdapterSeam using fixture-backed mocks.
// Why: Keep provider boundary deterministic without real network calls.
// Info flow: Fixtures -> mock/adapter -> assertions.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
	XAIChatResponseSchema,
	XAIImageResponseSchema
} from '../../src/lib/adapters/provider-adapter.adapter';
import { z } from 'zod';
import {
	ProviderChatInputSchema,
	ProviderChatResultSchema,
	ProviderImageInputSchema,
	ProviderImageResultSchema
} from '../../contracts/provider-adapter.contract';
import { ScenarioSchema } from '../../contracts/shared.contract';
import { createProviderAdapterMock } from '../../src/lib/mocks/provider-adapter.mock';
import { createProviderAdapter } from '../../src/lib/adapters/provider-adapter.adapter';
import sample from '../../fixtures/provider-adapter/sample.json';
import fault from '../../fixtures/provider-adapter/fault.json';

const fixtureSchema = z.object({
	scenario: ScenarioSchema,
	input: z.object({
		chat: ProviderChatInputSchema,
		image: ProviderImageInputSchema
	}),
	output: z.object({
		chat: ProviderChatResultSchema,
		image: ProviderImageResultSchema
	})
});

const sampleFixture = fixtureSchema.parse(sample);
const faultFixture = fixtureSchema.parse(fault);

const buildChatPayload = (output: typeof sampleFixture.output.chat) => {
	if (!output.ok) {
		return { error: { message: output.error.message } };
	}
	return {
		model: output.value.model,
		choices: [{ message: { content: output.value.content } }]
	};
};

const buildImagePayload = (output: typeof sampleFixture.output.image) => {
	if (!output.ok) {
		return { error: { message: output.error.message } };
	}
	return {
		data: output.value.images.map((image) => ({
			url: image.url,
			b64_json: image.b64_json
		})),
		revised_prompt: output.value.revisedPrompt
	};
};

const jsonResponse = (payload: unknown, status = 200): Response =>
	new Response(JSON.stringify(payload), {
		status,
		headers: { 'Content-Type': 'application/json' }
	});

const statusFromOutput = (
	output: typeof sampleFixture.output.chat | typeof sampleFixture.output.image
): number => {
	if (!output.ok) {
		const rawStatus = output.error.details?.status;
		const parsed = rawStatus ? Number(rawStatus) : Number.NaN;
		if (Number.isFinite(parsed) && parsed > 0) {
			return parsed;
		}
	}
	return 400;
};

let providerAdapter = createProviderAdapter({
	apiKey: 'test-key',
	baseUrl: 'https://api.x.ai'
});

beforeEach(() => {
	const fetchMock = vi.fn(async (input: RequestInfo, init?: RequestInit) => {
		const url = typeof input === 'string' ? input : input.toString();
		const body = init?.body ? JSON.parse(String(init.body)) : {};
		const messageHasFail = Array.isArray(body.messages)
			? body.messages.some((message: { content?: string }) =>
					typeof message.content === 'string' && message.content.includes('fail')
				)
			: false;
		const promptHasFail = typeof body.prompt === 'string' && body.prompt.includes('fail');
		const isFault =
			(typeof body.model === 'string' && body.model.includes('bad')) ||
			messageHasFail ||
			promptHasFail;

		if (url.includes('/v1/chat/completions')) {
			if (isFault) {
				return jsonResponse(
					buildChatPayload(faultFixture.output.chat),
					statusFromOutput(faultFixture.output.chat)
				);
			}
			return jsonResponse(buildChatPayload(sampleFixture.output.chat));
		}

		if (url.includes('/v1/images/generations')) {
			if (isFault) {
				return jsonResponse(
					buildImagePayload(faultFixture.output.image),
					statusFromOutput(faultFixture.output.image)
				);
			}
			return jsonResponse(buildImagePayload(sampleFixture.output.image));
		}

		return jsonResponse({ error: { message: 'Unexpected URL' } }, 500);
	});

	vi.stubGlobal('fetch', fetchMock);
	providerAdapter = createProviderAdapter({
		apiKey: 'test-key',
		baseUrl: 'https://api.x.ai'
	});
});

afterEach(() => {
	vi.unstubAllGlobals();
});

describe('ProviderAdapterSeam contract', () => {
	it('mock returns sample fixture output', async () => {
		const mock = createProviderAdapterMock('sample');
		const chatOutput = await mock.createChatCompletion(sampleFixture.input.chat);
		const imageOutput = await mock.createImageGeneration(sampleFixture.input.image);
		expect(chatOutput).toEqual(sampleFixture.output.chat);
		expect(imageOutput).toEqual(sampleFixture.output.image);
	});

	it('mock returns fault fixture output', async () => {
		const mock = createProviderAdapterMock('fault');
		const chatOutput = await mock.createChatCompletion(faultFixture.input.chat);
		const imageOutput = await mock.createImageGeneration(faultFixture.input.image);
		expect(chatOutput).toEqual(faultFixture.output.chat);
		expect(imageOutput).toEqual(faultFixture.output.image);
	});

	it('adapter returns sample fixture output', async () => {
		const chatOutput = await providerAdapter.createChatCompletion(sampleFixture.input.chat);
		const imageOutput = await providerAdapter.createImageGeneration(sampleFixture.input.image);
		expect(chatOutput).toEqual(sampleFixture.output.chat);
		expect(imageOutput).toEqual(sampleFixture.output.image);
	});

	it('adapter returns fault fixture output', async () => {
		const chatOutput = await providerAdapter.createChatCompletion(faultFixture.input.chat);
		const imageOutput = await providerAdapter.createImageGeneration(faultFixture.input.image);
		expect(chatOutput).toEqual(faultFixture.output.chat);
		expect(imageOutput).toEqual(faultFixture.output.image);
	});
});

// ---------------------------------------------------------------------------
// Raw response schema validation — tests that the Zod schemas at the seam
// boundary accept well-formed payloads and reject structurally invalid ones.
// These are unit tests of the schemas themselves; the adapter integration
// tests above cover the full request path.
// ---------------------------------------------------------------------------

describe('XAIChatResponseSchema', () => {
	it('accepts a well-formed chat response', () => {
		const result = XAIChatResponseSchema.safeParse({
			model: 'grok-4',
			choices: [{ message: { content: 'hello' } }]
		});
		expect(result.success).toBe(true);
	});

	it('accepts a response using the legacy text field', () => {
		const result = XAIChatResponseSchema.safeParse({
			model: 'grok-4',
			choices: [{ text: 'hello' }]
		});
		expect(result.success).toBe(true);
	});

	it('accepts a response with missing model (uses fallback downstream)', () => {
		const result = XAIChatResponseSchema.safeParse({
			choices: [{ message: { content: 'hello' } }]
		});
		expect(result.success).toBe(true);
		if (result.success) expect(result.data.model).toBeUndefined();
	});

	it('accepts a response with null choices (maps to PROVIDER_EMPTY_CHAT)', () => {
		const result = XAIChatResponseSchema.safeParse({ model: 'grok-4', choices: null });
		expect(result.success).toBe(true);
	});

	it('accepts a response with an empty choices array', () => {
		const result = XAIChatResponseSchema.safeParse({ model: 'grok-4', choices: [] });
		expect(result.success).toBe(true);
	});

	it('accepts a response with null message content', () => {
		const result = XAIChatResponseSchema.safeParse({
			choices: [{ message: { content: null } }]
		});
		expect(result.success).toBe(true);
	});

	it('passes through unknown top-level fields', () => {
		const result = XAIChatResponseSchema.safeParse({
			model: 'grok-4',
			choices: [{ message: { content: 'hi' } }],
			usage: { prompt_tokens: 10 }
		});
		expect(result.success).toBe(true);
		if (result.success) expect((result.data as { usage?: unknown }).usage).toBeDefined();
	});

	it('rejects a non-object payload (null)', () => {
		expect(XAIChatResponseSchema.safeParse(null).success).toBe(false);
	});

	it('rejects a non-object payload (string)', () => {
		expect(XAIChatResponseSchema.safeParse('bad').success).toBe(false);
	});

	it('rejects a non-object payload (array)', () => {
		expect(XAIChatResponseSchema.safeParse([]).success).toBe(false);
	});

	it('rejects when choices is not an array', () => {
		expect(
			XAIChatResponseSchema.safeParse({ choices: 'not-an-array' }).success
		).toBe(false);
	});
});

describe('XAIImageResponseSchema', () => {
	it('accepts a well-formed image response with url', () => {
		const result = XAIImageResponseSchema.safeParse({
			data: [{ url: 'https://example.com/img.png' }],
			revised_prompt: 'a cat'
		});
		expect(result.success).toBe(true);
	});

	it('accepts a response with b64_json images', () => {
		const result = XAIImageResponseSchema.safeParse({
			data: [{ b64_json: 'base64data' }]
		});
		expect(result.success).toBe(true);
	});

	it('accepts a response with camelCase revisedPrompt', () => {
		const result = XAIImageResponseSchema.safeParse({
			data: [{ url: 'https://example.com/img.png' }],
			revisedPrompt: 'a dog'
		});
		expect(result.success).toBe(true);
		if (result.success) expect(result.data.revisedPrompt).toBe('a dog');
	});

	it('accepts a response with null data (maps to PROVIDER_EMPTY_IMAGE)', () => {
		const result = XAIImageResponseSchema.safeParse({ data: null });
		expect(result.success).toBe(true);
	});

	it('accepts a response with an empty data array', () => {
		const result = XAIImageResponseSchema.safeParse({ data: [] });
		expect(result.success).toBe(true);
	});

	it('accepts data entries with no url or b64_json (filtered out downstream)', () => {
		const result = XAIImageResponseSchema.safeParse({
			data: [{ other: 'field' }]
		});
		expect(result.success).toBe(true);
	});

	it('passes through unknown top-level fields', () => {
		const result = XAIImageResponseSchema.safeParse({
			data: [{ url: 'https://example.com/img.png' }],
			created: 1234567890
		});
		expect(result.success).toBe(true);
		if (result.success) expect((result.data as { created?: unknown }).created).toBeDefined();
	});

	it('rejects a non-object payload (null)', () => {
		expect(XAIImageResponseSchema.safeParse(null).success).toBe(false);
	});

	it('rejects a non-object payload (string)', () => {
		expect(XAIImageResponseSchema.safeParse('bad').success).toBe(false);
	});

	it('rejects when data is not an array', () => {
		expect(
			XAIImageResponseSchema.safeParse({ data: 'not-an-array' }).success
		).toBe(false);
	});
});

describe('ProviderAdapterSeam normalization — malformed raw responses', () => {
	let adapter = createProviderAdapter({ apiKey: 'test-key', baseUrl: 'https://api.x.ai' });

	beforeEach(() => {
		adapter = createProviderAdapter({ apiKey: 'test-key', baseUrl: 'https://api.x.ai' });
	});

	// Note: no createProviderAdapterMock counterpart exists here. The formal mock operates above the HTTP layer and cannot simulate parse-level failures. Inline vi.stubGlobal stubs serve as the mock boundary for these tests.
	it('chat: returns PROVIDER_INVALID_RESPONSE when payload is a bare string', async () => {
		vi.stubGlobal('fetch', async () => jsonResponse('"unexpected string"'));
		const result = await adapter.createChatCompletion(sampleFixture.input.chat);
		expect(result.ok).toBe(false);
		if (!result.ok) expect(result.error.code).toBe('PROVIDER_INVALID_RESPONSE');
	});

	it('chat: returns PROVIDER_INVALID_RESPONSE when payload is an array', async () => {
		vi.stubGlobal('fetch', async () => jsonResponse([]));
		const result = await adapter.createChatCompletion(sampleFixture.input.chat);
		expect(result.ok).toBe(false);
		if (!result.ok) expect(result.error.code).toBe('PROVIDER_INVALID_RESPONSE');
	});

	it('chat: returns PROVIDER_EMPTY_CHAT when choices is empty', async () => {
		vi.stubGlobal('fetch', async () => jsonResponse({ model: 'grok-4', choices: [] }));
		const result = await adapter.createChatCompletion(sampleFixture.input.chat);
		expect(result.ok).toBe(false);
		if (!result.ok) expect(result.error.code).toBe('PROVIDER_EMPTY_CHAT');
	});

	it('chat: returns PROVIDER_EMPTY_CHAT when message content is null', async () => {
		vi.stubGlobal(
			'fetch',
			async () => jsonResponse({ model: 'grok-4', choices: [{ message: { content: null } }] })
		);
		const result = await adapter.createChatCompletion(sampleFixture.input.chat);
		expect(result.ok).toBe(false);
		if (!result.ok) expect(result.error.code).toBe('PROVIDER_EMPTY_CHAT');
	});

	it('chat: returns PROVIDER_EMPTY_CHAT when message content is empty string', async () => {
		vi.stubGlobal(
			'fetch',
			async () => jsonResponse({ model: 'grok-4', choices: [{ message: { content: '' } }] })
		);
		const result = await adapter.createChatCompletion(sampleFixture.input.chat);
		expect(result.ok).toBe(false);
		if (!result.ok) expect(result.error.code).toBe('PROVIDER_EMPTY_CHAT');
	});

	it('chat: falls back to legacy text when message content is blank', async () => {
		vi.stubGlobal(
			'fetch',
			async () =>
				jsonResponse({
					model: 'grok-4',
					choices: [{ message: { content: '   ' }, text: 'legacy content' }]
				})
		);
		const result = await adapter.createChatCompletion(sampleFixture.input.chat);
		expect(result.ok).toBe(true);
		if (result.ok) expect(result.value.content).toBe('legacy content');
	});

	it('chat: uses fallback model when model field is absent', async () => {
		vi.stubGlobal(
			'fetch',
			async () => jsonResponse({ choices: [{ message: { content: 'hello' } }] })
		);
		const result = await adapter.createChatCompletion(sampleFixture.input.chat);
		expect(result.ok).toBe(true);
		if (result.ok) expect(result.value.model).toBe(sampleFixture.input.chat.model);
	});

	it('chat: accepts legacy text field when message is absent', async () => {
		vi.stubGlobal(
			'fetch',
			async () => jsonResponse({ model: 'grok-4', choices: [{ text: 'legacy content' }] })
		);
		const result = await adapter.createChatCompletion(sampleFixture.input.chat);
		expect(result.ok).toBe(true);
		if (result.ok) expect(result.value.content).toBe('legacy content');
	});

	it('image: returns PROVIDER_INVALID_RESPONSE when payload is a bare string', async () => {
		vi.stubGlobal('fetch', async () => jsonResponse('"unexpected"'));
		const result = await adapter.createImageGeneration(sampleFixture.input.image);
		expect(result.ok).toBe(false);
		if (!result.ok) expect(result.error.code).toBe('PROVIDER_INVALID_RESPONSE');
	});

	it('image: returns PROVIDER_EMPTY_IMAGE when data is an empty array', async () => {
		vi.stubGlobal('fetch', async () => jsonResponse({ data: [] }));
		const result = await adapter.createImageGeneration(sampleFixture.input.image);
		expect(result.ok).toBe(false);
		if (!result.ok) expect(result.error.code).toBe('PROVIDER_EMPTY_IMAGE');
	});

	it('image: returns PROVIDER_EMPTY_IMAGE when data entries lack url and b64_json', async () => {
		vi.stubGlobal('fetch', async () => jsonResponse({ data: [{ other: 'field' }] }));
		const result = await adapter.createImageGeneration(sampleFixture.input.image);
		expect(result.ok).toBe(false);
		if (!result.ok) expect(result.error.code).toBe('PROVIDER_EMPTY_IMAGE');
	});

	it('image: returns PROVIDER_EMPTY_IMAGE when data is null', async () => {
		vi.stubGlobal('fetch', async () => jsonResponse({ data: null }));
		const result = await adapter.createImageGeneration(sampleFixture.input.image);
		expect(result.ok).toBe(false);
		if (!result.ok) expect(result.error.code).toBe('PROVIDER_EMPTY_IMAGE');
	});

	it('image: omits revisedPrompt when absent from response', async () => {
		vi.stubGlobal(
			'fetch',
			async () => jsonResponse({ data: [{ url: 'https://example.com/img.png' }] })
		);
		const result = await adapter.createImageGeneration(sampleFixture.input.image);
		expect(result.ok).toBe(true);
		if (result.ok) expect(result.value.revisedPrompt).toBeUndefined();
	});

	it('image: reads revisedPrompt from camelCase field', async () => {
		vi.stubGlobal(
			'fetch',
			async () =>
				jsonResponse({
					data: [{ url: 'https://example.com/img.png' }],
					revisedPrompt: 'a cat in a hat'
				})
		);
		const result = await adapter.createImageGeneration(sampleFixture.input.image);
		expect(result.ok).toBe(true);
		if (result.ok) expect(result.value.revisedPrompt).toBe('a cat in a hat');
	});
});
