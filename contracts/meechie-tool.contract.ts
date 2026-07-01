// Purpose: Define the MeechieToolSeam contract and supported tool inputs.
// Why: Keep the Meechie tools deterministic, testable, and auditable.
// Info flow: Tool input -> adapter response -> UI display.
import { z } from 'zod';
import { NonEmptyStringSchema, resultSchema } from './shared.contract';
import type { Result } from './shared.contract';

// Bounds the cost of the disallowed-keyword scan that runs ahead of rate
// limiting (see checkMeechieToolSafety) — far above any genuine tool input,
// so it never rejects legitimate requests. Exported so src/lib/seams/meechie-tool-seam/contract.ts
// (the seam this legacy contract supersedes per docs/seams.md) imports these instead of
// re-declaring them, so the two contracts can't silently drift apart.
export const MAX_FREE_TEXT_LENGTH = 2000;
export const MAX_LINEUP_ITEM_LENGTH = 200;
const FreeTextInputSchema = NonEmptyStringSchema.max(MAX_FREE_TEXT_LENGTH);

export const MeechieToolIdSchema = z.enum([
	'apology_translator',
	'red_flag_or_run',
	'wwmd',
	'lineup',
	'horoscope',
	'receipts',
	'caption_this',
	'clapback',
	'meechie_explains',
	'rate_excuse',
	'random_meechie'
]);

const ApologyInputSchema = z.object({
	toolId: z.literal('apology_translator'),
	apology: FreeTextInputSchema
});

const RedFlagInputSchema = z.object({
	toolId: z.literal('red_flag_or_run'),
	situation: FreeTextInputSchema
});

const WwmdInputSchema = z.object({
	toolId: z.literal('wwmd'),
	dilemma: FreeTextInputSchema
});

const LineupInputSchema = z.object({
	toolId: z.literal('lineup'),
	prompt: FreeTextInputSchema,
	items: z.array(NonEmptyStringSchema.max(MAX_LINEUP_ITEM_LENGTH)).min(1).max(6)
});

export const HoroscopeSignSchema = z.enum([
	'Aries',
	'Taurus',
	'Gemini',
	'Cancer',
	'Leo',
	'Virgo',
	'Libra',
	'Scorpio',
	'Sagittarius',
	'Capricorn',
	'Aquarius',
	'Pisces'
]);

const HoroscopeInputSchema = z.object({
	toolId: z.literal('horoscope'),
	sign: HoroscopeSignSchema
});

const ReceiptsInputSchema = z.object({
	toolId: z.literal('receipts'),
	claim: FreeTextInputSchema,
	reality: FreeTextInputSchema
});

const CaptionInputSchema = z.object({
	toolId: z.literal('caption_this'),
	moment: FreeTextInputSchema
});

const ClapbackInputSchema = z.object({
	toolId: z.literal('clapback'),
	comment: FreeTextInputSchema
});

const ExplainsInputSchema = z.object({
	toolId: z.literal('meechie_explains'),
	term: FreeTextInputSchema
});

const RateExcuseInputSchema = z.object({
	toolId: z.literal('rate_excuse'),
	excuse: FreeTextInputSchema
});

const RandomMeechieInputSchema = z.object({
	toolId: z.literal('random_meechie')
});

export const MeechieToolInputSchema = z.discriminatedUnion('toolId', [
	ApologyInputSchema,
	RedFlagInputSchema,
	WwmdInputSchema,
	LineupInputSchema,
	HoroscopeInputSchema,
	ReceiptsInputSchema,
	CaptionInputSchema,
	ClapbackInputSchema,
	ExplainsInputSchema,
	RateExcuseInputSchema,
	RandomMeechieInputSchema
]);

const MeechieQuoteSubscoreSchema = z.object({
	key: NonEmptyStringSchema,
	max: z.number().int().min(1),
	score: z.number().int().min(0),
	reason: NonEmptyStringSchema
});

const MeechieQuotePenaltySchema = z.object({
	key: NonEmptyStringSchema,
	points: z.number().int().min(1),
	reason: NonEmptyStringSchema
});

const MeechieQuoteScoreDetailsSchema = z.object({
	quote: NonEmptyStringSchema,
	totalBeforePenalties: z.number().int().min(0).max(100),
	totalPenalty: z.number().int().min(0),
	totalScore: z.number().int().min(0).max(100),
	band: z.enum(['Approved', 'Revise', 'Rewrite', 'Reject']),
	subscores: z.array(MeechieQuoteSubscoreSchema).length(10),
	penalties: z.array(MeechieQuotePenaltySchema),
	reasons: z.array(NonEmptyStringSchema)
});

export const MeechieToolOutputSchema = z.object({
	toolId: MeechieToolIdSchema,
	headline: NonEmptyStringSchema,
	response: NonEmptyStringSchema,
	rating: z.number().int().min(1).max(10).optional(),
	quoteScore: MeechieQuoteScoreDetailsSchema.optional()
});

export const MeechieToolResultSchema = resultSchema(MeechieToolOutputSchema);

export type MeechieToolInput = z.infer<typeof MeechieToolInputSchema>;
export type MeechieToolOutput = z.infer<typeof MeechieToolOutputSchema>;

export type MeechieToolSeam = {
	respond(input: MeechieToolInput): Promise<Result<MeechieToolOutput>>;
};
