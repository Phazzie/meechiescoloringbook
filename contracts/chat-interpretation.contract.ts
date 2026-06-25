// Purpose: Define the ChatInterpretationSeam contract.
// Why: Map free-text intent to a structured ColoringPageSpec.
// Info flow: User text -> structured spec -> validation.
import { z } from 'zod';
import { ColoringPageSpecSchema } from './spec-validation.contract';
import { NonEmptyStringSchema, resultSchema } from './shared.contract';
import type { Result } from './shared.contract';

// Caps free-text chat input so an oversized message fails CHAT_INPUT_INVALID
// before consuming rate-limit quota or reaching the paid provider call, rather
// than forwarding megabyte-scale text to the xAI chat completion endpoint.
export const MAX_CHAT_MESSAGE_LENGTH = 4000;

export const ChatInterpretationInputSchema = z.object({
	message: NonEmptyStringSchema.max(MAX_CHAT_MESSAGE_LENGTH)
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
