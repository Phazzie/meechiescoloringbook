// Purpose: Contract tests for MeechieToolSeam using fixture-backed mocks and provider mocking.
// Why: Verify the tool seam contract is honored by both mock and AI-backed adapter.
// Info flow: Fixtures -> mock/adapter -> assertions.
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { MeechieToolInputSchema } from './contract';
import { meechieToolSampleFixture, meechieToolFaultFixture } from './fixtures';
import { createMeechieToolMock } from './mock';

const mockCreateChatCompletion = vi.fn();

vi.mock('../../adapters/provider-adapter.adapter', () => ({
	createProviderAdapter: () => ({
		createChatCompletion: mockCreateChatCompletion,
		createImageGeneration: vi.fn()
	}),
	providerAdapter: {
		createChatCompletion: mockCreateChatCompletion,
		createImageGeneration: vi.fn()
	}
}));

const { meechieToolAdapter } = await import('../../adapters/meechie-tool-seam');

beforeEach(() => {
	mockCreateChatCompletion.mockReset();
});

describe('MeechieToolSeam contract', () => {
	it('mock returns sample fixture output', async () => {
		const mock = createMeechieToolMock('sample');
		const output = await mock.respond(meechieToolSampleFixture.input);
		expect(output).toEqual(meechieToolSampleFixture.output);
	});

	it('mock returns fault fixture output', async () => {
		const mock = createMeechieToolMock('fault');
		const output = await mock.respond(meechieToolFaultFixture.input);
		expect(output).toEqual(meechieToolFaultFixture.output);
	});

	it('adapter returns sample fixture output when provider returns matching content', async () => {
		expect(meechieToolSampleFixture.output.ok).toBe(true);
		if (!meechieToolSampleFixture.output.ok) throw new Error('sample fixture must be ok');
		const { headline, response } = meechieToolSampleFixture.output.value;
		mockCreateChatCompletion.mockResolvedValue({
			ok: true,
			value: {
				model: 'test-model',
				content: JSON.stringify({ headline, response })
			}
		});
		const output = await meechieToolAdapter.respond(meechieToolSampleFixture.input);
		expect(output).toEqual(meechieToolSampleFixture.output);
	});

	it('adapter returns fault fixture output when provider signals missing key', async () => {
		mockCreateChatCompletion.mockResolvedValue({
			ok: false,
			error: { code: 'PROVIDER_API_KEY_MISSING', message: 'XAI_API_KEY is required.' }
		});
		const output = await meechieToolAdapter.respond(meechieToolFaultFixture.input);
		expect(output).toEqual(meechieToolFaultFixture.output);
	});

	it('adapter sends Meechie system prompt for any tool input', async () => {
		mockCreateChatCompletion.mockResolvedValue({
			ok: true,
			value: {
				model: 'test-model',
				content: JSON.stringify({ headline: 'Run.', response: 'Fault: them. Consequence: access revoked.' })
			}
		});
		await meechieToolAdapter.respond({
			toolId: 'red_flag_or_run',
			situation: 'He said he is not ready for a relationship but wants to keep seeing me.'
		});
		const call = mockCreateChatCompletion.mock.calls[0][0];
		expect(call.messages[0].role).toBe('system');
		expect(call.messages[0].content).toContain('You are Meechie');
		expect(call.messages[1].content).toContain('Red Flag or Run');
	});

	it('adapter uses correct ordinal suffixes for lineup positions', async () => {
		mockCreateChatCompletion.mockResolvedValue({
			ok: true,
			value: {
				model: 'test-model',
				content: JSON.stringify({ headline: 'Ranked and Ruled', response: 'Lineup ranked.' })
			}
		});
		await meechieToolAdapter.respond({
			toolId: 'lineup',
			prompt: 'Rank these',
			items: Array.from({ length: 23 }, (_, i) => `Item ${i + 1}`)
		});
		const call = mockCreateChatCompletion.mock.calls[0][0];
		const content = call.messages[1].content;
		expect(content).toContain('11th: Item 11');
		expect(content).toContain('12th: Item 12');
		expect(content).toContain('13th: Item 13');
		expect(content).toContain('21st: Item 21');
		expect(content).toContain('22nd: Item 22');
		expect(content).toContain('23rd: Item 23');
		expect(content).not.toContain('21th: Item 21');
		expect(content).not.toContain('22th: Item 22');
		expect(content).not.toContain('23th: Item 23');
	});

	it('rejects free-text fields over the length cap, mirroring the legacy contract', () => {
		const result = MeechieToolInputSchema.safeParse({
			toolId: 'apology_translator',
			apology: 'a'.repeat(2001)
		});
		expect(result.success).toBe(false);
	});

	it('rejects lineup items over the per-item length cap', () => {
		const result = MeechieToolInputSchema.safeParse({
			toolId: 'lineup',
			prompt: 'Rank these',
			items: ['a'.repeat(201)]
		});
		expect(result.success).toBe(false);
	});
});
