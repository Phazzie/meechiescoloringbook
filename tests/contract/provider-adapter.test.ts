// Purpose: Contract tests for ProviderAdapterSeam using fixture-backed mocks.
// Why: Keep provider boundary deterministic without real network calls.
// Info flow: Fixtures -> mock/adapter -> assertions.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import {
	ProviderChatInputSchema,
	ProviderChatResultSchema,
	ProviderImageInputSchema,
	ProviderImageResultSchema
} from '../../contracts/provider-adapter.contract';
import { ScenarioSchema } from '../../contracts/shared.contract';
import { createProviderAdapterMock } from '../../src/lib/mocks/provider-adapter.mock';
vi.mock('$env/dynamic/private', () => ({
	env: {
		XAI_API_KEY: 'test-key',
		XAI_BASE_URL: 'https://api.x.ai'
	}
}));

import { providerAdapter } from '../../src/lib/adapters/provider-adapter.adapter';
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
