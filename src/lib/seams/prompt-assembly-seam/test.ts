// Purpose: Contract tests for PromptAssemblySeam.
// Why: Enforce mock and adapter adherence to the seam contract.
// Info flow: fixtures -> mock/adapter -> assertions.
import { describe, expect, it } from 'vitest';
import {
	promptAssemblySampleFixture,
	promptAssemblyFaultFixture,
	promptAssemblyTitleOnlyFixture
} from './fixtures';
import { createPromptAssemblyMock } from './mock';
import { promptAssemblyAdapter } from '../../adapters/prompt-assembly.adapter';

describe('PromptAssemblySeam mock contract', () => {
	it('mock returns sample fixture output', async () => {
		const mock = createPromptAssemblyMock('sample');
		const output = await mock.assemble(promptAssemblySampleFixture.input);
		expect(output).toEqual(promptAssemblySampleFixture.output);
	});

	it('mock returns fault fixture output', async () => {
		const mock = createPromptAssemblyMock('fault');
		const output = await mock.assemble(promptAssemblyFaultFixture.input);
		expect(output).toEqual(promptAssemblyFaultFixture.output);
	});
});

describe('PromptAssemblySeam adapter contract', () => {
	it('adapter returns sample fixture output', async () => {
		const output = await promptAssemblyAdapter.assemble(promptAssemblySampleFixture.input);
		expect(output).toEqual(promptAssemblySampleFixture.output);
	});

	it('adapter returns fault fixture output', async () => {
		const output = await promptAssemblyAdapter.assemble(promptAssemblyFaultFixture.input);
		expect(output).toEqual(promptAssemblyFaultFixture.output);
	});

	it('adapter returns title-only fixture output', async () => {
		const output = await promptAssemblyAdapter.assemble(promptAssemblyTitleOnlyFixture.input);
		expect(output).toEqual(promptAssemblyTitleOnlyFixture.output);
	});
});
