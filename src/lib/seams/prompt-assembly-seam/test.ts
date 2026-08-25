// Purpose: Contract tests for PromptAssemblySeam using fixture-backed mocks.
// Why: Keep prompt assembly deterministic and verifiable.
// Info flow: Fixtures -> mock/adapter -> assertions.
import { describe, expect, it } from 'vitest';
import {
	promptAssemblySampleFixture,
	promptAssemblyFaultFixture,
	promptAssemblyTitleOnlyFixture,
	promptAssemblyTitleOnlyMarkerFaultFixture
} from './fixtures';
import { createPromptAssemblyMock, createTitleOnlyMarkerFaultMock } from './mock';
import { promptAssemblyAdapter } from '../../adapters/prompt-assembly-seam';
import { validatePromptAssemblyExecution } from './validators';
import { PromptAssemblyInputSchema } from './contract';

describe('PromptAssemblySeam contract', () => {
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

	it('adapter returns sample fixture output', async () => {
		const output = await promptAssemblyAdapter.assemble(promptAssemblySampleFixture.input);
		expect(output).toEqual(promptAssemblySampleFixture.output);
		expect(() =>
			validatePromptAssemblyExecution(promptAssemblySampleFixture.input, output)
		).not.toThrow();
	});

	it('adapter returns fault fixture output', async () => {
		const output = await promptAssemblyAdapter.assemble(promptAssemblyFaultFixture.input);
		expect(output).toEqual(promptAssemblyFaultFixture.output);
	});

	it('adapter returns title-only fixture output', async () => {
		const output = await promptAssemblyAdapter.assemble(promptAssemblyTitleOnlyFixture.input);
		expect(output).toEqual(promptAssemblyTitleOnlyFixture.output);
		expect(() =>
			validatePromptAssemblyExecution(promptAssemblyTitleOnlyFixture.input, output)
		).not.toThrow();
	});

	it('places typography directly after a title with no secondary line', async () => {
		const result = await promptAssemblyAdapter.assemble(promptAssemblyTitleOnlyFixture.input);
		if (!result.ok) {
			throw new Error(result.error.message);
		}
		const promptLines = result.value.prompt.split('\n');
		const titleIndex = promptLines.indexOf('Dream Big');
		expect(promptLines.slice(titleIndex, titleIndex + 2)).toEqual(['Dream Big', 'TYPOGRAPHY:']);
		expect(promptLines).not.toContain('[Secondary line EXACT — omit if none.]');
	});
});

describe('PromptAssemblySeam title-only boundary fault fixture', () => {
	const fixture = promptAssemblyTitleOnlyMarkerFaultFixture as {
		input: unknown;
		output: unknown;
	};

	it('rejects the checked-in semantic fault', () => {
		expect(() => validatePromptAssemblyExecution(fixture.input, fixture.output)).toThrow(
			'A title-only prompt must not advertise a secondary exact-text line.'
		);
	});

	it('rejects the same fault when the mock serves it', async () => {
		const mock = createTitleOnlyMarkerFaultMock();
		const input = PromptAssemblyInputSchema.parse(fixture.input);
		const result = await mock.assemble(input);
		expect(() => validatePromptAssemblyExecution(input, result)).toThrow(
			'A title-only prompt must not advertise a secondary exact-text line.'
		);
	});
});
