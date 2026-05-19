// Purpose: Zod schemas for MeechieVoiceSeam.
// Why: Centralise all validation logic so contract.ts stays type-only.
// Info flow: validators -> contract types / mock / adapter.
import { z } from 'zod';
import { NonEmptyStringSchema, resultSchema } from '../../../../contracts/shared.contract';

const ToneSchema = z.object({
	summary: NonEmptyStringSchema,
	dos: z.array(NonEmptyStringSchema),
	donts: z.array(NonEmptyStringSchema),
	samples: z.array(NonEmptyStringSchema)
});

const HeadlineSchema = z.object({
	apologyTranslator: NonEmptyStringSchema,
	wwmd: NonEmptyStringSchema,
	lineup: NonEmptyStringSchema,
	horoscopeTemplate: NonEmptyStringSchema,
	receipts: NonEmptyStringSchema,
	caption: NonEmptyStringSchema,
	clapback: NonEmptyStringSchema,
	explains: NonEmptyStringSchema
});

const ResponsePairSchema = z.object({
	headline: NonEmptyStringSchema,
	response: NonEmptyStringSchema
});

const ApologyTranslatorSchema = z.object({
	exactMap: z.record(NonEmptyStringSchema),
	fallback: NonEmptyStringSchema
});

const RedFlagOrRunSchema = z.object({
	runKeywords: z.array(NonEmptyStringSchema).min(1),
	flagKeywords: z.array(NonEmptyStringSchema).min(1),
	runResponse: ResponsePairSchema,
	flagResponse: ResponsePairSchema,
	defaultResponse: ResponsePairSchema
});

const WwmdTriggerSchema = z
	.object({
		includesAny: z.array(NonEmptyStringSchema).min(1).optional(),
		includesAll: z.array(NonEmptyStringSchema).min(1).optional(),
		response: NonEmptyStringSchema
	})
	.refine((value) => value.includesAny || value.includesAll, {
		message: 'WWMD trigger must include includesAny or includesAll.'
	});

const WwmdSchema = z.object({
	triggers: z.array(WwmdTriggerSchema).min(1),
	fallback: NonEmptyStringSchema
});

const LineupSchema = z.object({
	comments: z.array(NonEmptyStringSchema).min(1),
	minItems: z.number().int().min(1),
	tooShortMessage: NonEmptyStringSchema
});

const HoroscopeSchema = z.object({
	map: z.record(NonEmptyStringSchema),
	fallback: NonEmptyStringSchema
});

const TemplateSchema = z.object({
	template: NonEmptyStringSchema
});

const ExplainsSchema = z.object({
	map: z.record(NonEmptyStringSchema),
	fallbackTemplate: NonEmptyStringSchema
});

const ExcuseRatingSchema = z.object({
	keywords: z.array(NonEmptyStringSchema).min(1),
	rating: z.number().int().min(1).max(10),
	commentary: NonEmptyStringSchema
});

const ExcuseRatingFallbackSchema = z.object({
	keywords: z.array(z.string()),
	rating: z.number().int().min(1).max(10),
	commentary: NonEmptyStringSchema
});

export const MeechieQuoteCategorySchema = z.enum(['raw_anchor', 'approved_keeper']);
export const MeechieQuoteRawnessSchema = z.enum(['clean', 'mild', 'raw']);
export const MeechieQuoteThirdPersonUsageSchema = z.enum(['none', 'sometimes', 'forced']);
export const MeechieQuoteModeFitSchema = z.enum([
	'random_meechie',
	'rate_excuse',
	'apology_translator',
	'red_flag_or_run',
	'wwmd',
	'caption_this',
	'clapback',
	'receipts'
]);

const MeechieQuoteSchema = z
	.object({
		text: NonEmptyStringSchema,
		category: MeechieQuoteCategorySchema,
		rawness: MeechieQuoteRawnessSchema,
		thirdPersonUsage: MeechieQuoteThirdPersonUsageSchema,
		modeFit: z.array(MeechieQuoteModeFitSchema).min(1),
		defaultMode: z.boolean(),
		coloringPageReady: z.boolean(),
		notes: NonEmptyStringSchema.optional(),
		visualMotifs: z.array(NonEmptyStringSchema).min(1).optional()
	})
	.strict();

const MeechieVoiceResponsesSchema = z.object({
	headlines: HeadlineSchema,
	apologyTranslator: ApologyTranslatorSchema,
	redFlagOrRun: RedFlagOrRunSchema,
	wwmd: WwmdSchema,
	lineup: LineupSchema,
	horoscope: HoroscopeSchema,
	receipts: TemplateSchema,
	caption: TemplateSchema,
	clapback: TemplateSchema,
	explains: ExplainsSchema,
	excuseRatings: z.array(ExcuseRatingSchema).min(1),
	excuseRatingFallback: ExcuseRatingFallbackSchema,
	quotes: z.array(MeechieQuoteSchema).min(1)
});

export const MeechieVoicePackSchema = z.object({
	voiceId: NonEmptyStringSchema,
	version: NonEmptyStringSchema,
	tone: ToneSchema,
	responses: MeechieVoiceResponsesSchema
});

export const MeechieVoiceInputSchema = z.object({
	voiceId: NonEmptyStringSchema
});

export const MeechieVoiceResultSchema = resultSchema(MeechieVoicePackSchema);

export const validateMeechieVoiceInput = (input: unknown) => MeechieVoiceInputSchema.parse(input);
export const validateMeechieVoiceResult = (result: unknown) => MeechieVoiceResultSchema.parse(result);
