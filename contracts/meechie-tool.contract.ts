// Purpose: Define the MeechieToolSeam contract and supported tool inputs.
// Why: Keep the Meechie tools deterministic, testable, and auditable.
// Info flow: Tool input -> adapter response -> UI display.
import { z } from 'zod';
import { NonEmptyStringSchema, resultSchema } from './shared.contract';
import type { Result } from './shared.contract';

export const MeechieToolIdSchema = z.enum([
	'apology_translator',
	'red_flag_or_run',
	'wwmd',
	'lineup',
	'horoscope',
	'receipts',
	'caption_this',
	'clapback',
	'meechie_explains'
]);

const ApologyInputSchema = z.object({
	toolId: z.literal('apology_translator'),
	apology: NonEmptyStringSchema
});

const RedFlagInputSchema = z.object({
	toolId: z.literal('red_flag_or_run'),
	situation: NonEmptyStringSchema
});

const WwmdInputSchema = z.object({
	toolId: z.literal('wwmd'),
	dilemma: NonEmptyStringSchema
});

const LineupInputSchema = z.object({
	toolId: z.literal('lineup'),
	prompt: NonEmptyStringSchema,
	items: z.array(NonEmptyStringSchema).min(1).max(6)
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
	claim: NonEmptyStringSchema,
	reality: NonEmptyStringSchema
});

const CaptionInputSchema = z.object({
	toolId: z.literal('caption_this'),
	moment: NonEmptyStringSchema
});

const ClapbackInputSchema = z.object({
	toolId: z.literal('clapback'),
	comment: NonEmptyStringSchema
});

const ExplainsInputSchema = z.object({
	toolId: z.literal('meechie_explains'),
	term: NonEmptyStringSchema
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
	ExplainsInputSchema
]);

export const MeechieToolOutputSchema = z.object({
	toolId: MeechieToolIdSchema,
	headline: NonEmptyStringSchema,
	response: NonEmptyStringSchema
});

export const MeechieToolResultSchema = resultSchema(MeechieToolOutputSchema);

export type MeechieToolInput = z.infer<typeof MeechieToolInputSchema>;
export type MeechieToolOutput = z.infer<typeof MeechieToolOutputSchema>;

export type MeechieToolSeam = {
	respond(input: MeechieToolInput): Promise<Result<MeechieToolOutput>>;
};
