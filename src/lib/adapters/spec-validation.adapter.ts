// Purpose: Adapter implementation for SpecValidationSeam.
// Why: Enforce spec constraints deterministically before downstream work.
// Info flow: Raw spec -> validation issues -> decision gating.
import type { ZodIssue } from 'zod';
import {
	ColoringPageSpecSchema,
	MAX_SPEC_ITEMS,
	SpecValidationInputSchema,
	SpecValidationIssueSchema
} from '../../../contracts/spec-validation.contract';
import type {
	SpecValidationInput,
	SpecValidationOutput,
	SpecValidationSeam
} from '../../../contracts/spec-validation.contract';

const formatPath = (path: Array<string | number>): string => {
	const withoutRoot = path.filter((segment) => segment !== 'spec');
	return withoutRoot
		.map((segment) =>
			typeof segment === 'number' ? `[${segment}]` : `${segment}`
		)
		.join('.')
		.replace('.[', '[');
};

const issueFromZod = (issue: ZodIssue): SpecValidationOutput['issues'][number] => {
	const field = formatPath(issue.path);
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
			message: `List cannot exceed ${MAX_SPEC_ITEMS} items.`
		};
	}

	if (pathString.endsWith('label')) {
		if (issue.code === 'invalid_string') {
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

export const specValidationAdapter: SpecValidationSeam = {
	validate: async (input: SpecValidationInput): Promise<SpecValidationOutput> => {
		const parsedInput = SpecValidationInputSchema.safeParse(input);
		if (!parsedInput.success) {
			const issues = parsedInput.error.issues.map(issueFromZod);
			const normalizedIssues = issues.map((issue) => SpecValidationIssueSchema.parse(issue));
			return {
				ok: false,
				issues: normalizedIssues
			};
		}

		const parsedSpec = ColoringPageSpecSchema.safeParse(parsedInput.data.spec);
		if (parsedSpec.success) {
			return {
				ok: true,
				issues: []
			};
		}

		const issues = parsedSpec.error.issues.map(issueFromZod);
		const normalizedIssues = issues.map((issue) => SpecValidationIssueSchema.parse(issue));

		return {
			ok: false,
			issues: normalizedIssues
		};
	}
};
