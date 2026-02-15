// Purpose: Contract tests for MeechieToolSeam using fixture-backed mocks.
// Why: Ensure deterministic responses for Meechie tools.
// Info flow: Fixtures -> mock/adapter -> assertions.
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import {
	MeechieToolInputSchema,
	MeechieToolResultSchema
} from '../../contracts/meechie-tool.contract';
import { ScenarioSchema } from '../../contracts/shared.contract';
import { createMeechieToolMock } from '../../src/lib/mocks/meechie-tool.mock';
import { meechieToolAdapter } from '../../src/lib/adapters/meechie-tool.adapter';
import sample from '../../fixtures/meechie-tool/sample.json';
import fault from '../../fixtures/meechie-tool/fault.json';

const fixtureSchema = z.object({
	scenario: ScenarioSchema,
	input: MeechieToolInputSchema,
	output: MeechieToolResultSchema
});

const sampleFixture = fixtureSchema.parse(sample);
const faultFixture = fixtureSchema.parse(fault);

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

	it('adapter returns sample fixture output', async () => {
		const output = await meechieToolAdapter.respond(sampleFixture.input);
		expect(output).toEqual(sampleFixture.output);
	});

	it('adapter returns fault fixture output', async () => {
		const output = await meechieToolAdapter.respond(faultFixture.input);
		expect(output).toEqual(faultFixture.output);
	});

	it('adapter flags run scenarios when keywords match', async () => {
		const output = await meechieToolAdapter.respond({
			toolId: 'red_flag_or_run',
			situation: 'He said he is not ready for a relationship but wants to keep seeing me.'
		});
		expect(output.ok).toBe(true);
		if (output.ok) {
			expect(output.value.headline).toBe('Run');
		}
	});
});
