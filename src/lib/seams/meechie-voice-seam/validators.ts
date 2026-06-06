// Purpose: Validate MeechieVoiceSeam inputs and outputs.
// Why: Keep runtime data aligned with the contract schema.
// Info flow: adapter/mock -> validators -> errors.
import { MeechieVoiceInputSchema, MeechieVoiceResultSchema } from './contract';

export const validateMeechieVoiceInput = (input: unknown) =>
	MeechieVoiceInputSchema.parse(input);

export const validateMeechieVoiceResult = (result: unknown) =>
	MeechieVoiceResultSchema.parse(result);
