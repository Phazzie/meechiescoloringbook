// Purpose: Define MeechieVoiceSeam contract types.
// Why: Keep seam interfaces explicit and shared across implementations.
// Info flow: contract types -> adapters/mocks/tests.
import type { z } from 'zod';
import type {
	MeechieVoicePackSchema,
	MeechieVoiceInputSchema,
	MeechieVoiceResultSchema,
	MeechieQuoteCategorySchema,
	MeechieQuoteRawnessSchema,
	MeechieQuoteThirdPersonUsageSchema,
	MeechieQuoteModeFitSchema
} from './validators';
import type { Result } from '../../../../contracts/shared.contract';

export type MeechieVoicePack = z.infer<typeof MeechieVoicePackSchema>;
export type MeechieVoiceInput = z.infer<typeof MeechieVoiceInputSchema>;
export type MeechieVoiceResult = z.infer<typeof MeechieVoiceResultSchema>;
export type MeechieQuoteCategory = z.infer<typeof MeechieQuoteCategorySchema>;
export type MeechieQuoteRawness = z.infer<typeof MeechieQuoteRawnessSchema>;
export type MeechieQuoteThirdPersonUsage = z.infer<typeof MeechieQuoteThirdPersonUsageSchema>;
export type MeechieQuoteModeFit = z.infer<typeof MeechieQuoteModeFitSchema>;
// Derived from MeechieVoicePackSchema.responses.quotes element
export type MeechieQuote = MeechieVoicePack['responses']['quotes'][number];

export type MeechieVoiceSeam = {
	getVoicePack(input: MeechieVoiceInput): Promise<Result<MeechieVoicePack>>;
};
