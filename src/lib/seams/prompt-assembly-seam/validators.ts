// Purpose: Validate PromptAssemblySeam inputs and outputs.
// Why: Keep runtime data aligned with the contract schema.
// Info flow: adapter/mock -> validators -> errors.
import { z } from 'zod';
import { PromptAssemblyInputSchema, PromptAssemblyResultSchema } from './contract';

const SECONDARY_LINE_MARKER = '[Secondary line EXACT — omit if none.]';

export const PromptAssemblyExecutionSchema = z
	.object({
		input: PromptAssemblyInputSchema,
		result: PromptAssemblyResultSchema
	})
	.superRefine(({ input, result }, context) => {
		if (!result.ok) return;

		const promptLines = result.value.prompt.split('\n');
		const markerIndexes = promptLines.flatMap((line, index) =>
			line === SECONDARY_LINE_MARKER ? [index] : []
		);
		const secondaryLine = input.spec.footerItem?.label.trim();

		if (!secondaryLine && markerIndexes.length > 0) {
			context.addIssue({
				code: 'custom',
				path: ['result', 'value', 'prompt'],
				message: 'A title-only prompt must not advertise a secondary exact-text line.'
			});
		}

		if (
			secondaryLine &&
			(markerIndexes.length !== 1 || promptLines[markerIndexes[0] + 1] !== secondaryLine)
		) {
			context.addIssue({
				code: 'custom',
				path: ['result', 'value', 'prompt'],
				message: 'The secondary exact-text marker must be followed by footerItem.'
			});
		}
	});

export const validatePromptAssemblyInput = (input: unknown) =>
	PromptAssemblyInputSchema.parse(input);

export const validatePromptAssemblyResult = (result: unknown) =>
	PromptAssemblyResultSchema.parse(result);

export const validatePromptAssemblyExecution = (input: unknown, result: unknown) =>
	PromptAssemblyExecutionSchema.parse({ input, result });
