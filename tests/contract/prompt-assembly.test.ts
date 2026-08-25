// Purpose: Contract tests for PromptAssemblySeam using fixture-backed mocks.
// Why: Keep prompt assembly deterministic and verifiable.
// Info flow: Fixtures -> mock/adapter -> assertions.
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import {
	PromptAssemblyInputSchema,
	PromptAssemblyResultSchema
} from '../../contracts/prompt-assembly.contract';
import { ScenarioSchema } from '../../contracts/shared.contract';
import { createPromptAssemblyMock } from '../../src/lib/mocks/prompt-assembly.mock';
import { promptAssemblyAdapter } from '../../src/lib/adapters/prompt-assembly.adapter';
import sample from '../../fixtures/prompt-assembly/sample.json';
import fault from '../../fixtures/prompt-assembly/fault.json';
import titleOnly from '../../fixtures/prompt-assembly/title-only.json';

const fixtureSchema = z.object({
	scenario: ScenarioSchema,
	input: PromptAssemblyInputSchema,
	output: PromptAssemblyResultSchema
});

const sampleFixture = fixtureSchema.parse(sample);
const faultFixture = fixtureSchema.parse(fault);
const titleOnlyFixture = fixtureSchema.parse(titleOnly);

describe('PromptAssemblySeam contract', () => {
	it('mock returns sample fixture output', async () => {
		const mock = createPromptAssemblyMock('sample');
		const output = await mock.assemble(sampleFixture.input);
		expect(output).toEqual(sampleFixture.output);
	});

	it('mock returns fault fixture output', async () => {
		const mock = createPromptAssemblyMock('fault');
		const output = await mock.assemble(faultFixture.input);
		expect(output).toEqual(faultFixture.output);
	});

	it('adapter returns sample fixture output', async () => {
		const output = await promptAssemblyAdapter.assemble(sampleFixture.input);
		expect(output).toEqual(sampleFixture.output);
	});

	it('adapter returns fault fixture output', async () => {
		const output = await promptAssemblyAdapter.assemble(faultFixture.input);
		expect(output).toEqual(faultFixture.output);
	});

	it('adapter returns title-only fixture output', async () => {
		const output = await promptAssemblyAdapter.assemble(titleOnlyFixture.input);
		expect(output).toEqual(titleOnlyFixture.output);
	});

	it('terminates title-only drawable text before the next template heading', async () => {
		const output = await promptAssemblyAdapter.assemble(titleOnlyFixture.input);
		expect(output.ok).toBe(true);
		if (!output.ok) {
			throw new Error(output.error.message);
		}
		expect(output.value.prompt).not.toContain('Second line, render');
		expect(output.value.prompt).toContain(
			'Headline, render these exact words and nothing else: "Dream Big"\n' +
				'End of the headline block. Do not draw any section label.\n' +
				'TYPOGRAPHY:'
		);
	});
});
