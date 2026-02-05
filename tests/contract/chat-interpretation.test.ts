// Purpose: Contract tests for ChatInterpretationSeam using fixture-backed mocks.
// Why: Ensure chat intent mapping remains deterministic.
// Info flow: Fixtures -> mock/adapter -> assertions.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import {
	ChatInterpretationInputSchema,
	ChatInterpretationResultSchema
} from '../../contracts/chat-interpretation.contract';
import { ScenarioSchema } from '../../contracts/shared.contract';
import { createChatInterpretationMock } from '../../src/lib/mocks/chat-interpretation.mock';
import { chatInterpretationAdapter } from '../../src/lib/adapters/chat-interpretation.adapter';
import sample from '../../fixtures/chat-interpretation/sample.json';
import fault from '../../fixtures/chat-interpretation/fault.json';

const fixtureSchema = z.object({
	scenario: ScenarioSchema,
	input: ChatInterpretationInputSchema,
	output: ChatInterpretationResultSchema
});

const sampleFixture = fixtureSchema.parse(sample);
const faultFixture = fixtureSchema.parse(fault);

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
	fetchMock = vi.fn(async () => {
		return new Response(JSON.stringify(sampleFixture.output), {
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
		expect(fetchMock).not.toHaveBeenCalled();
	});
});
