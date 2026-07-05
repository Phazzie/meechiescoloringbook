// Purpose: Map validator issues to SpecValidationSeam issue codes.
// Why: Share fault-classification logic between the legacy and self-contained SpecValidationSeam adapters without coupling core logic to a third-party validator.
// Info flow: Structural validation issue -> classified spec validation issue.

export type ValidationIssueLike = {
	path: ReadonlyArray<PropertyKey>;
	code: string;
	message: string;
};

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

export const mapValidationIssueToSpecValidationIssue = (
	issue: ValidationIssueLike,
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

	if (issue.code === 'custom') {
		return {
			code: 'SPEC_INVALID',
			field: field || 'spec',
			message: issue.message
		};
	}

	return {
		code: 'SPEC_INVALID',
		field: field || 'spec',
		message: 'Spec field failed validation.'
	};
};
