// MIGRATED: canonical location is src/lib/seams/spec-validation-seam/.
// This file re-exports from the new self-contained layout for backward compatibility.
// Update imports to use the new location directly.
export {
	MAX_SPEC_ITEMS,
	MAX_LABEL_LENGTH,
	MAX_DEDICATION_LENGTH,
	ALLOWED_TEXT_REGEX,
	ADVANCED_SPEC_FIELDS,
	AlignmentSchema,
	NumberAlignmentSchema,
	ListModeSchema,
	ListGutterSchema,
	TextSizeSchema,
	FontStyleSchema,
	ColorModeSchema,
	DecorationDensitySchema,
	IllustrationModeSchema,
	ShadingModeSchema,
	BorderStyleSchema,
	OutputFormatSchema,
	PageSizeSchema,
	LabelSchema,
	DedicationSchema,
	ItemNumberSchema,
	ColoringPageItemSchema,
	RawColoringPageItemSchema,
	ColoringPageSpecSchema,
	RawColoringPageSpecSchema,
	SpecValidationInputSchema,
	SpecValidationIssueSchema,
	SpecValidationOutputSchema,
	validateColoringPageSpec,
	validateSpecValidationInput,
	validateSpecValidationOutput
} from '../src/lib/seams/spec-validation-seam/validators';

export type {
	ColoringPageSpec,
	PageSize,
	SpecValidationInput,
	SpecValidationOutput,
	SpecValidationSeam
} from '../src/lib/seams/spec-validation-seam/contract';
