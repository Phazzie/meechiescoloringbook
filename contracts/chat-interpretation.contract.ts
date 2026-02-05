// Purpose: Define the ChatInterpretationSeam contract.
// Why: Map free-text intent to a structured ColoringPageSpec.
// Info flow: User text -> structured spec -> validation.
import { z } from 'zod';
import { ColoringPageSpecSchema } from './spec-validation.contract';
import { NonEmptyStringSchema, resultSchema } from './shared.contract';
import type { Result } from './shared.contract';

export const ChatInterpretationInputSchema = z.object({
	message: NonEmptyStringSchema
});

export const ChatInterpretationOutputSchema = z.object({
	spec: ColoringPageSpecSchema
});

export const ChatInterpretationResultSchema = resultSchema(ChatInterpretationOutputSchema);

export type ChatInterpretationInput = z.infer<typeof ChatInterpretationInputSchema>;
export type ChatInterpretationOutput = z.infer<typeof ChatInterpretationOutputSchema>;

export type ChatInterpretationSeam = {
	interpret(input: ChatInterpretationInput): Promise<Result<ChatInterpretationOutput>>;
};
