// Purpose: Contract tests for MeechieToolSeam using fixture-backed mocks and provider mocking.
// Why: Verify the tool seam contract is honored by both mock and AI-backed adapter.
// Info flow: Fixtures -> mock/adapter -> assertions.
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { z } from 'zod';
import {
	MeechieToolInputSchema,
	MeechieToolResultSchema
} from '../../contracts/meechie-tool.contract';
import { ScenarioSchema } from '../../contracts/shared.contract';
import { createMeechieToolMock } from '../../src/lib/mocks/meechie-tool.mock';
import sample from '../../fixtures/meechie-tool/sample.json';
import fault from '../../fixtures/meechie-tool/fault.json';

const mockCreateChatCompletion = vi.fn();

vi.mock('../../src/lib/adapters/provider-adapter.adapter', () => ({
	createProviderAdapter: () => ({
		createChatCompletion: mockCreateChatCompletion,
		createImageGeneration: vi.fn()
	})
}));

const { meechieToolAdapter } = await import('../../src/lib/adapters/meechie-tool.adapter');

const fixtureSchema = z.object({
	scenario: ScenarioSchema,
	input: MeechieToolInputSchema,
	output: MeechieToolResultSchema
});

const sampleFixture = fixtureSchema.parse(sample);
const faultFixture = fixtureSchema.parse(fault);

beforeEach(() => {
	mockCreateChatCompletion.mockReset();
});

describe('MeechieToolSeam contract', () => {
	it('mock returns sample fixture output', async () => {
		const mock = createMeechieToolMock('sample');
		const output = await mock.respond(sampleFixture.input);
		expect(output).toEqual(sampleFixture.output);
	});

	it('mock returns fault fixture output', async () => {
		const mock = createMeechieToolMock('fault');
		const output = await mock.respond(faultFixture.input);
		expect(output).toEqual(faultFixture.output);
	});

	it('adapter returns sample fixture output when provider returns matching content', async () => {
		expect(sampleFixture.output.ok).toBe(true);
		if (!sampleFixture.output.ok) throw new Error('sample fixture must be ok');
		const { headline, response } = sampleFixture.output.value;
		mockCreateChatCompletion.mockResolvedValue({
			ok: true,
			value: {
				model: 'test-model',
				content: JSON.stringify({ headline, response })
			}
		});
		const output = await meechieToolAdapter.respond(sampleFixture.input);
		expect(output).toEqual(sampleFixture.output);
	});

	it('adapter returns fault fixture output when provider signals missing key', async () => {
		mockCreateChatCompletion.mockResolvedValue({
			ok: false,
			error: { code: 'PROVIDER_API_KEY_MISSING', message: 'XAI_API_KEY is required.' }
		});
		const output = await meechieToolAdapter.respond(faultFixture.input);
		expect(output).toEqual(faultFixture.output);
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
