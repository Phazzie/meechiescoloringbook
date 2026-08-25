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
import {
	createPromptAssemblyMock,
	createTitleOnlyMarkerFaultMock
} from './mock';
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
		const output = await promptAssemblyAdapter.assemble(
			promptAssemblySampleFixture.input
		);
		expect(output).toEqual(promptAssemblySampleFixture.output);
		expect(() =>
			validatePromptAssemblyExecution(promptAssemblySampleFixture.input, output)
		).not.toThrow();
	});

	it('adapter returns fault fixture output', async () => {
		const output = await promptAssemblyAdapter.assemble(
			promptAssemblyFaultFixture.input
		);
		expect(output).toEqual(promptAssemblyFaultFixture.output);
	});

	it('adapter returns title-only fixture output', async () => {
		const output = await promptAssemblyAdapter.assemble(
			promptAssemblyTitleOnlyFixture.input
		);
		expect(output).toEqual(promptAssemblyTitleOnlyFixture.output);
		expect(() =>
			validatePromptAssemblyExecution(
				promptAssemblyTitleOnlyFixture.input,
				output
			)
		).not.toThrow();
	});

	it('terminates drawable text before typography when there is no footer', async () => {
		const result = await promptAssemblyAdapter.assemble(
			promptAssemblyTitleOnlyFixture.input
		);
		if (!result.ok) {
			throw new Error(result.error.message);
		}
		const promptLines = result.value.prompt.split('\n');
		// The drawable value sits on its own line after its instruction rather than being
		// wrapped in quotes: ALLOWED_TEXT_REGEX permits a double quote inside a title, so a
		// quote delimiter is indistinguishable from content for an input like: He said "Go".
		const instruction = 'Headline, render these exact words and nothing else:';
		const instructionIndex = promptLines.indexOf(instruction);
		expect(promptLines.slice(instructionIndex, instructionIndex + 4)).toEqual([
			instruction,
			'Dream Big',
			'End of the headline block. Do not draw any section label.',
			'TYPOGRAPHY:'
		]);
		expect(
			promptLines.some((line) => line.startsWith('Second line, render'))
		).toBe(false);
	});
});

describe('PromptAssemblySeam title-only boundary fault fixture', () => {
	const fixture = promptAssemblyTitleOnlyMarkerFaultFixture as {
		input: unknown;
		output: unknown;
	};

	it('rejects the checked-in semantic fault', () => {
		expect(() =>
			validatePromptAssemblyExecution(fixture.input, fixture.output)
		).toThrow(
			'Drawable text must match the headline/footer boundary and terminate before TYPOGRAPHY.'
		);
	});

	it('rejects the same fault when the mock serves it', async () => {
		const mock = createTitleOnlyMarkerFaultMock();
		const input = PromptAssemblyInputSchema.parse(fixture.input);
		const result = await mock.assemble(input);
		expect(() => validatePromptAssemblyExecution(input, result)).toThrow(
			'Drawable text must match the headline/footer boundary and terminate before TYPOGRAPHY.'
		);
	});
});
