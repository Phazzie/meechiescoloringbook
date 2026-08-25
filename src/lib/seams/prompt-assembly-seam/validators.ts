// Purpose: Validate PromptAssemblySeam inputs and outputs.
// Why: Keep runtime data aligned with the contract schema.
// Info flow: adapter/mock -> validators -> errors.
import { z } from 'zod';
import {
	PromptAssemblyInputSchema,
	PromptAssemblyResultSchema
} from './contract';

const TEXT_HEADING = 'TEXT (exact):';
const TEXT_TERMINATOR =
	'End of the headline block. Do not draw any section label.';
const TYPOGRAPHY_HEADING = 'TYPOGRAPHY:';
const SECONDARY_INSTRUCTION_PREFIX =
	'Second line, render these exact words and nothing else: ';

const countExactLines = (lines: string[], expected: string): number =>
	lines.filter((line) => line === expected).length;

export const PromptAssemblyExecutionSchema = z
	.object({
		input: PromptAssemblyInputSchema,
		result: PromptAssemblyResultSchema
	})
	.superRefine(({ input, result }, context) => {
		if (!result.ok) return;

		const promptLines = result.value.prompt.split('\n');
		const headlineInstruction = `Headline, render these exact words and nothing else: "${input.spec.title}"`;
		const secondaryLine = input.spec.footerItem?.label;
		const secondaryInstruction = secondaryLine
			? `Second line, render these exact words and nothing else: "${secondaryLine}"`
			: undefined;
		const expectedTextBlock = [
			TEXT_HEADING,
			headlineInstruction,
			...(secondaryInstruction ? [secondaryInstruction] : []),
			TEXT_TERMINATOR,
			TYPOGRAPHY_HEADING
		];
		const textHeadingIndex = promptLines.indexOf(TEXT_HEADING);
		const actualTextBlock = promptLines.slice(
			textHeadingIndex,
			textHeadingIndex + expectedTextBlock.length
		);
		const secondaryInstructions = promptLines.filter((line) =>
			line.startsWith(SECONDARY_INSTRUCTION_PREFIX)
		);
		const hasExactBoundary =
			textHeadingIndex >= 0 &&
			actualTextBlock.every(
				(line, index) => line === expectedTextBlock[index]
			) &&
			actualTextBlock.length === expectedTextBlock.length &&
			countExactLines(promptLines, headlineInstruction) === 1 &&
			countExactLines(promptLines, TEXT_TERMINATOR) === 1 &&
			secondaryInstructions.length === (secondaryInstruction ? 1 : 0);

		if (!hasExactBoundary) {
			context.addIssue({
				code: 'custom',
				path: ['result', 'value', 'prompt'],
				message:
					'Drawable text must match the headline/footer boundary and terminate before TYPOGRAPHY.'
			});
		}
	});

export const validatePromptAssemblyInput = (input: unknown) =>
	PromptAssemblyInputSchema.parse(input);

export const validatePromptAssemblyResult = (result: unknown) =>
	PromptAssemblyResultSchema.parse(result);

export const validatePromptAssemblyExecution = (
	input: unknown,
	result: unknown
) => PromptAssemblyExecutionSchema.parse({ input, result });
