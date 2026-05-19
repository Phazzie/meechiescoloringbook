// MIGRATED: canonical location is src/lib/seams/meechie-voice-seam/.
// This file re-exports from the new self-contained layout for backward compatibility.
// Update imports to use the new location directly.
export {
	MeechieVoicePackSchema,
	MeechieVoiceInputSchema,
	MeechieVoiceResultSchema,
	MeechieQuoteCategorySchema,
	MeechieQuoteRawnessSchema,
	MeechieQuoteThirdPersonUsageSchema,
	MeechieQuoteModeFitSchema,
	validateMeechieVoiceInput,
	validateMeechieVoiceResult
} from '../src/lib/seams/meechie-voice-seam/validators';

export type {
	MeechieVoicePack,
	MeechieVoiceInput,
	MeechieVoiceResult,
	MeechieQuoteCategory,
	MeechieQuoteRawness,
	MeechieQuoteThirdPersonUsage,
	MeechieQuoteModeFit,
	MeechieQuote,
	MeechieVoiceSeam
} from '../src/lib/seams/meechie-voice-seam/contract';
