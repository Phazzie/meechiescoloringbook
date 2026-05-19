// Purpose: Contract tests for MeechieToolSeam.
// Why: Enforce mock and adapter adherence to the seam contract.
// Info flow: fixtures -> mock/adapter -> assertions.
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { meechieToolSampleFixture, meechieToolFaultFixture } from './fixtures';
import { createMeechieToolMock } from './mock';

const mockCreateChatCompletion = vi.fn();

vi.mock('../../adapters/provider-adapter.adapter', () => ({
	createProviderAdapter: () => ({
		createChatCompletion: mockCreateChatCompletion,
		createImageGeneration: vi.fn()
	})
}));

const { meechieToolAdapter } = await import('../../adapters/meechie-tool.adapter');

beforeEach(() => {
	mockCreateChatCompletion.mockReset();
});

describe('MeechieToolSeam mock contract', () => {
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
});

describe('MeechieToolSeam adapter contract', () => {
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
});
