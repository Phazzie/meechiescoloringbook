// Purpose: Define the shape of a single Meechie voice line.
// Why: The legacy and self-contained MeechieVoiceSeam contracts both need this
//      schema; defining it once keeps the two layouts from drifting apart.
// Info flow: quote schema -> both voice contracts -> voice pack validation.
import { z } from 'zod';
import { NonEmptyStringSchema } from './shared.contract';

export const MeechieQuoteTierSchema = z.enum(['canon', 'approved']);

export const MeechieQuoteSchema = z
	.object({
		// canon = verified original Meechie. approved = ruled in by the owner.
		tier: MeechieQuoteTierSchema,
		// Stable handle for a line. Never reused, never renamed.
		id: NonEmptyStringSchema,
		// The wording IS the line. Do not normalize, expand, or clean it up.
		text: NonEmptyStringSchema
	})
	.strict();

export type MeechieQuoteTier = z.infer<typeof MeechieQuoteTierSchema>;
export type MeechieQuote = z.infer<typeof MeechieQuoteSchema>;
