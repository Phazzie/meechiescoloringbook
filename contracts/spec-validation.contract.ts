// Purpose: Define the ColoringPageSpec and its validation contract.
// Why: Enforce input constraints before any generation or storage.
// Info flow: User input -> validation -> downstream seams.
import { z } from 'zod';
import { NonEmptyStringSchema } from './shared.contract';

export const MAX_SPEC_ITEMS = 20;
export const MAX_LABEL_LENGTH = 40;
export const MAX_DEDICATION_LENGTH = 60;
export const ALLOWED_TEXT_REGEX = /^[A-Za-z0-9 .,!?'":;\-()]+$/;

export const AlignmentSchema = z.enum(['left', 'center']);
export const NumberAlignmentSchema = z.enum(['strict', 'loose']);
export const ListModeSchema = z.enum(['list', 'title_only']);
export const ListGutterSchema = z.enum(['tight', 'normal', 'loose']);
export const TextSizeSchema = z.enum(['small', 'medium', 'large']);
export const FontStyleSchema = z.enum(['rounded', 'block', 'hand']);
export const ColorModeSchema = z.enum(['black_and_white_only', 'grayscale', 'color']);
export const DecorationDensitySchema = z.enum(['none', 'minimal', 'dense']);
export const IllustrationModeSchema = z.enum(['none', 'simple', 'scene']);
export const ShadingModeSchema = z.enum(['none', 'hatch', 'stippling']);
export const BorderStyleSchema = z.enum(['none', 'plain', 'decorative']);
export const OutputFormatSchema = z.enum(['png', 'pdf']);
export const PageSizeSchema = z.enum(['US_Letter', 'A4']);

export const LabelSchema = z
	.string()
	.min(1)
	.max(MAX_LABEL_LENGTH)
	.regex(ALLOWED_TEXT_REGEX);

export const DedicationSchema = z
	.string()
	.min(1)
	.max(MAX_DEDICATION_LENGTH)
	.regex(ALLOWED_TEXT_REGEX);

export const ItemNumberSchema = z.number().int().min(1).max(999);

export const ColoringPageItemSchema = z.object({
	number: ItemNumberSchema,
	label: LabelSchema
});

export const RawColoringPageItemSchema = z.object({
	number: z.number().int(),
	label: z.string()
});

export const ColoringPageSpecSchema = z.object({
	title: NonEmptyStringSchema,
	items: z.array(ColoringPageItemSchema).max(MAX_SPEC_ITEMS),
	footerItem: ColoringPageItemSchema.optional(),
	dedication: DedicationSchema.optional(),
	listMode: ListModeSchema.default('list'),
	alignment: AlignmentSchema.default('left'),
	numberAlignment: NumberAlignmentSchema.default('strict'),
	listGutter: ListGutterSchema.default('normal'),
	whitespaceScale: z.number().min(0).max(100),
	textSize: TextSizeSchema.default('small'),
	fontStyle: FontStyleSchema.default('rounded'),
	textStrokeWidth: z.number().int().min(4).max(12).default(6),
	colorMode: ColorModeSchema.default('black_and_white_only'),
	decorations: DecorationDensitySchema.default('none'),
	illustrations: IllustrationModeSchema.default('none'),
	shading: ShadingModeSchema.default('none'),
	border: BorderStyleSchema.default('plain'),
	borderThickness: z.number().int().min(2).max(16).default(8),
	variations: z.number().int().min(1).max(4),
	outputFormat: OutputFormatSchema,
	pageSize: PageSizeSchema.default('US_Letter')
}).superRefine((spec, ctx) => {
	if (spec.listMode === 'list' && spec.items.length === 0) {
		ctx.addIssue({
			code: z.ZodIssueCode.custom,
			path: ['items'],
			message: 'List mode requires at least one item.'
		});
	}
	if (spec.listMode === 'title_only' && spec.items.length > 0) {
		ctx.addIssue({
			code: z.ZodIssueCode.custom,
			path: ['items'],
			message: 'Title-only mode does not allow list items.'
		});
	}
	if (spec.listMode === 'title_only' && spec.footerItem) {
		ctx.addIssue({
			code: z.ZodIssueCode.custom,
			path: ['footerItem'],
			message: 'Title-only mode does not allow a footer item.'
		});
	}
	if (
		spec.shading !== 'none' &&
		spec.decorations === 'none' &&
		spec.illustrations === 'none'
	) {
		ctx.addIssue({
			code: z.ZodIssueCode.custom,
			path: ['shading'],
			message: 'Shading requires decorations or illustrations.'
		});
	}
});

export const RawColoringPageSpecSchema = z.object({
	title: z.string(),
	items: z.array(RawColoringPageItemSchema),
	footerItem: RawColoringPageItemSchema.optional(),
	dedication: z.string().optional(),
	listMode: z.string().optional(),
	alignment: z.string().optional(),
	numberAlignment: z.string().optional(),
	listGutter: z.string().optional(),
	whitespaceScale: z.number().optional(),
	textSize: z.string().optional(),
	fontStyle: z.string().optional(),
	textStrokeWidth: z.number().optional(),
	colorMode: z.string().optional(),
	decorations: z.string().optional(),
	illustrations: z.string().optional(),
	shading: z.string().optional(),
	border: z.string().optional(),
	borderThickness: z.number().optional(),
	variations: z.number().optional(),
	outputFormat: z.string().optional(),
	pageSize: z.string().optional()
});

export type ColoringPageSpec = z.infer<typeof ColoringPageSpecSchema>;

export const SpecValidationInputSchema = z.object({
	spec: RawColoringPageSpecSchema
});

export const SpecValidationIssueSchema = z.object({
	code: NonEmptyStringSchema,
	field: NonEmptyStringSchema,
	message: NonEmptyStringSchema
});

export const SpecValidationOutputSchema = z.object({
	ok: z.boolean(),
	issues: z.array(SpecValidationIssueSchema)
});

export type SpecValidationInput = z.infer<typeof SpecValidationInputSchema>;
export type SpecValidationOutput = z.infer<typeof SpecValidationOutputSchema>;

export type SpecValidationSeam = {
	validate(input: SpecValidationInput): Promise<SpecValidationOutput>;
};
