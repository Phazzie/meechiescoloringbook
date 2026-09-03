// Purpose: Define the shape of a single Meechie voice line.
// Why: The legacy and self-contained MeechieVoiceSeam contracts both need this
//      schema; defining it once keeps the two layouts from drifting apart.
// Info flow: quote schema -> both voice contracts -> voice pack validation.
import { z } from 'zod';
import { NonEmptyStringSchema } from './shared.contract';

// A quote is an id and its wording, nothing else. It carried a `tier`
// ('canon' | 'approved') until 2026-09-03. Once the ten fabricated 'approved'
// lines were cut, every surviving line was canon — one possible value, and no
// code ever branched on it. Provenance is a note for humans, so it lives in the
// voice pack's comments rather than in a field that reads like behavior.
// `.strict()` below means a pack still carrying `tier` fails validation loudly
// instead of being silently ignored.
export const MeechieQuoteSchema = z
	.object({
		// Stable handle for a line. Never reused, never renamed.
		id: NonEmptyStringSchema,
		// The wording IS the line. Do not normalize, expand, or clean it up.
		text: NonEmptyStringSchema
	})
	.strict();

export type MeechieQuote = z.infer<typeof MeechieQuoteSchema>;
