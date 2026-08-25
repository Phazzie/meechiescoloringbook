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
const HEADLINE_INSTRUCTION = 'Headline, render these exact words and nothing else:';
const SECONDARY_INSTRUCTION = 'Second line, render these exact words and nothing else:';

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
		// Each drawable value sits alone on the line after its instruction. It is deliberately
		// NOT wrapped in quotes: ALLOWED_TEXT_REGEX permits a double quote inside a title or
		// label, so a quote delimiter cannot be told apart from content for `He said "Go"`.
		const secondaryLine = input.spec.footerItem?.label;
		const expectedTextBlock = [
			TEXT_HEADING,
			HEADLINE_INSTRUCTION,
			input.spec.title,
			...(secondaryLine ? [SECONDARY_INSTRUCTION, secondaryLine] : []),
			TEXT_TERMINATOR,
			TYPOGRAPHY_HEADING
		];
		const textHeadingIndex = promptLines.indexOf(TEXT_HEADING);
		const actualTextBlock = promptLines.slice(
			textHeadingIndex,
			textHeadingIndex + expectedTextBlock.length
		);
		const expectedControlLineCounts: Array<[string, number]> = [
			[TEXT_HEADING, 1],
			[HEADLINE_INSTRUCTION, 1],
			[SECONDARY_INSTRUCTION, secondaryLine ? 1 : 0],
			[TEXT_TERMINATOR, 1],
			[TYPOGRAPHY_HEADING, 1]
		];
		const hasExactBoundary =
			textHeadingIndex >= 0 &&
			actualTextBlock.every(
				(line, index) => line === expectedTextBlock[index]
			) &&
			actualTextBlock.length === expectedTextBlock.length &&
			expectedControlLineCounts.every(
				([line, count]) => countExactLines(promptLines, line) === count
			);

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
