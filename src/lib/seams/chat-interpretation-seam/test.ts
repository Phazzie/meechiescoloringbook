// Purpose: Contract tests for ChatInterpretationSeam using fixture-backed mocks.
// Why: Ensure chat intent mapping remains deterministic.
// Info flow: Fixtures -> mock/adapter -> assertions.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import {
	ChatInterpretationInputSchema,
	ChatInterpretationResultSchema
} from './contract';
import { ScenarioSchema } from '../../../../contracts/shared.contract';
import { createChatInterpretationMock } from './mock';
import { chatInterpretationAdapter } from '../../adapters/chat-interpretation-seam';
import { chatInterpretationSampleFixture, chatInterpretationFaultFixture } from './fixtures';

const fixtureSchema = z.object({
	scenario: ScenarioSchema,
	input: ChatInterpretationInputSchema,
	output: ChatInterpretationResultSchema
});

const sampleFixture = fixtureSchema.parse(chatInterpretationSampleFixture);
const faultFixture = fixtureSchema.parse(chatInterpretationFaultFixture);

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
	fetchMock = vi.fn(async (_url: RequestInfo | URL, init?: RequestInit) => {
		const body = init?.body ? JSON.parse(String(init.body)) : {};
		const message = typeof body.message === 'string' ? body.message : '';
		const payload = message.includes('fail') ? { ok: true, value: {} } : sampleFixture.output;

		return new Response(JSON.stringify(payload), {
			status: 200,
			headers: { 'Content-Type': 'application/json' }
		});
	});
	vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
	vi.unstubAllGlobals();
});

describe('ChatInterpretationSeam contract', () => {
	it('mock returns sample fixture output', async () => {
		const mock = createChatInterpretationMock('sample');
		const output = await mock.interpret(sampleFixture.input);
		expect(output).toEqual(sampleFixture.output);
	});

	it('mock returns fault fixture output', async () => {
		const mock = createChatInterpretationMock('fault');
		const output = await mock.interpret(faultFixture.input);
		expect(output).toEqual(faultFixture.output);
	});

	it('adapter returns sample fixture output', async () => {
		const output = await chatInterpretationAdapter.interpret(sampleFixture.input);
		expect(output).toEqual(sampleFixture.output);
	});

	it('adapter returns fault fixture output', async () => {
		const output = await chatInterpretationAdapter.interpret(faultFixture.input);
		expect(output).toEqual(faultFixture.output);
		expect(fetchMock).toHaveBeenCalledTimes(1);
	});
});

describe('ChatInterpretationSeam adapter network error handling', () => {
	it('adapter returns CHAT_NETWORK_ERROR when fetch throws an Error', async () => {
		fetchMock.mockRejectedValueOnce(new Error('Network connection refused'));

		const output = await chatInterpretationAdapter.interpret({ message: 'Make me a coloring page' });

		expect(output.ok).toBe(false);
		if (!output.ok) {
			expect(output.error.code).toBe('CHAT_NETWORK_ERROR');
			expect(output.error.message).toBe('Network connection refused');
		}
	});

	it('adapter returns CHAT_RESPONSE_INVALID when server returns a non-contract payload', async () => {
		fetchMock.mockResolvedValueOnce(
			new Response(JSON.stringify({ unexpected: 'shape' }), {
				status: 200,
				headers: { 'Content-Type': 'application/json' }
			})
		);

		const output = await chatInterpretationAdapter.interpret({ message: 'Make me a coloring page' });

		expect(output.ok).toBe(false);
		if (!output.ok) {
			expect(output.error.code).toBe('CHAT_RESPONSE_INVALID');
		}
	});

	it('adapter returns CHAT_NETWORK_ERROR with fallback message for non-Error rejections', async () => {
		fetchMock.mockRejectedValueOnce('string rejection value');

		const output = await chatInterpretationAdapter.interpret({ message: 'Test' });

		expect(output.ok).toBe(false);
		if (!output.ok) {
			expect(output.error.code).toBe('CHAT_NETWORK_ERROR');
			expect(output.error.message).toBe('Chat request failed.');
		}
	});

	it('adapter posts the message to /api/chat-interpretation with correct headers and body', async () => {
		fetchMock.mockResolvedValueOnce(
			new Response(JSON.stringify(sampleFixture.output), {
				status: 200,
				headers: { 'Content-Type': 'application/json' }
			})
		);

		const testMessage = 'I want butterflies and rainbows';
		await chatInterpretationAdapter.interpret({ message: testMessage });

		expect(fetchMock).toHaveBeenCalledOnce();
		const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
		expect(url).toBe('/api/chat-interpretation');
		expect(init?.method).toBe('POST');
		expect((init?.headers as Record<string, string>)?.['Content-Type']).toBe('application/json');
		const body = JSON.parse(String(init?.body));
		expect(body.message).toBe(testMessage);
	});
});
