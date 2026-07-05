// Purpose: Map zod validation issues to SpecValidationSeam issue codes.
// Why: Share fault-classification logic between the legacy and self-contained SpecValidationSeam adapters.
// Info flow: Zod issue -> classified spec validation issue.
import type { ZodIssue } from 'zod';

export type SpecValidationMappedIssue = {
	code: string;
	field: string;
	message: string;
};

const formatSpecValidationIssuePath = (path: ReadonlyArray<PropertyKey>): string => {
	const withoutRoot = path.filter((segment) => segment !== 'spec');
	return withoutRoot
		.map((segment) => (typeof segment === 'number' ? `[${segment}]` : String(segment)))
		.join('.')
		.replace('.[', '[');
};

export const mapZodIssueToSpecValidationIssue = (
	issue: ZodIssue,
	maxSpecItems: number
): SpecValidationMappedIssue => {
	const field = formatSpecValidationIssuePath(issue.path);
	const pathString = issue.path.map((segment) => String(segment)).join('.');

	if (pathString.endsWith('items.0.number') || pathString.endsWith('number')) {
		if (issue.code === 'too_small' || issue.code === 'too_big' || issue.code === 'invalid_type') {
			return {
				code: 'ITEM_NUMBER_OUT_OF_RANGE',
				field: field || 'items.number',
				message: 'Item number must be between 1 and 999.'
			};
		}
	}

	if (pathString === 'items' && issue.code === 'too_big') {
		return {
			code: 'ITEMS_TOO_MANY',
			field: 'items',
			message: `List cannot exceed ${maxSpecItems} items.`
		};
	}

	if (pathString.endsWith('label')) {
		if (issue.code === 'invalid_format') {
			return {
				code: 'LABEL_INVALID_CHARS',
				field: field || 'items.label',
				message: 'Label contains invalid characters.'
			};
		}
		if (issue.code === 'too_small' || issue.code === 'too_big') {
			return {
				code: 'LABEL_LENGTH_OUT_OF_RANGE',
				field: field || 'items.label',
				message: 'Label must be between 1 and 40 characters.'
			};
		}
	}

	return {
		code: 'SPEC_INVALID',
		field: field || 'spec',
		message: issue.message
	};
};
