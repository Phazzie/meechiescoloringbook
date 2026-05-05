// Purpose: Contract tests for MeechieStudioTextSeam.
// Why: Prove AI text results use fixture-backed structure before adapter work.
// Info flow: Fixtures -> mock/adapter -> result assertions.
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import {
	MeechieStudioTextInputSchema,
	MeechieStudioTextResultSchema
} from '../../contracts/meechie-studio-text.contract';
import { ScenarioSchema } from '../../contracts/shared.contract';
import { createMeechieStudioTextAdapter } from '../../src/lib/adapters/meechie-studio-text.adapter';
import { createMeechieStudioTextMock } from '../../src/lib/mocks/meechie-studio-text.mock';
import sample from '../../fixtures/meechie-studio-text/sample.json';
import fault from '../../fixtures/meechie-studio-text/fault.json';

const fixtureSchema = z.object({
	scenario: ScenarioSchema,
	input: MeechieStudioTextInputSchema,
	output: MeechieStudioTextResultSchema
});

const sampleFixture = fixtureSchema.parse(sample);
const faultFixture = fixtureSchema.parse(fault);
const sampleOutput = sampleFixture.output.ok ? sampleFixture.output.value : null;

describe('MeechieStudioTextSeam contract', () => {
	it('mock returns sample fixture output', async () => {
		const mock = createMeechieStudioTextMock('sample');
		const output = await mock.respond(sampleFixture.input);
		expect(output).toEqual(sampleFixture.output);
	});

	it('mock returns fault fixture output', async () => {
		const mock = createMeechieStudioTextMock('fault');
		const output = await mock.respond(faultFixture.input);
		expect(output).toEqual(faultFixture.output);
	});

	it('adapter returns sample fixture output when provider supplies fixture JSON', async () => {
		const adapter = createMeechieStudioTextAdapter({
			createProvider: () => ({
				createChatCompletion: async () => ({
					ok: true,
					value: {
						model: 'meechie-studio-text-fixture',
						content: JSON.stringify(sampleOutput)
					}
				}),
				createImageGeneration: async () => ({
					ok: false,
					error: { code: 'UNUSED', message: 'Unused in this adapter test.' }
				})
			})
		});
		const output = await adapter.respond(sampleFixture.input);
		expect(output.ok).toBe(true);
		if (output.ok) {
			expect(output.value.verdict).toBe(sampleOutput?.verdict);
			expect(output.value.pageItems).toHaveLength(3);
		}
	});
});
