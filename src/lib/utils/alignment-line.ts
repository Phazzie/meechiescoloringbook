// Purpose: Provide shared wording for alignment enforcement across seams.
// Why: Keep prompt text and drift detection expectations synchronized.
// Info flow: ColoringPageSpec -> formatted alignment sentence -> shared adapters.
import type { ColoringPageSpec } from '../../../contracts/spec-validation.contract';

const SPACING_CLAUSE = 'treat blank space as intentional; do not fill empty space.';

export const formatAlignmentLine = (spec: ColoringPageSpec): string => {
	const spacing = `${SPACING_CLAUSE}`;

	if (spec.listMode === 'title_only') {
		return spec.alignment === 'center'
			? `text centered; ${spacing}`
			: `all text left-aligned; ${spacing}`;
	}

	const numberClause =
		spec.numberAlignment === 'strict' ? 'all numbers vertically aligned; ' : 'numbers readable; ';
	const textClause = spec.alignment === 'center' ? 'text centered; ' : 'all text left-aligned; ';
	return `${numberClause}${textClause}${spacing}`;
};
