// Purpose: Unit tests for shared SpecValidationSeam issue-mapping logic.
// Why: Prove custom-refine messages stay stable while generic validator issue text is kept seam-owned, not leaked from a third-party validator.
// Info flow: Structural validation issue -> mapped spec validation issue.
import { describe, expect, it } from 'vitest';
import { mapValidationIssueToSpecValidationIssue } from '../../src/lib/core/spec-validation-issue-mapping';

describe('mapValidationIssueToSpecValidationIssue', () => {
	it('keeps custom refine messages as authored', () => {
		const result = mapValidationIssueToSpecValidationIssue(
			{
				path: ['spec', 'shading'],
				code: 'custom',
				message: 'Shading requires decorations or illustrations.'
			},
			20
		);

		expect(result).toEqual({
			code: 'SPEC_INVALID',
			field: 'shading',
			message: 'Shading requires decorations or illustrations.'
		});
	});

	it('replaces generic validator issue text with a stable seam-owned message', () => {
		const result = mapValidationIssueToSpecValidationIssue(
			{
				path: ['spec', 'outputFormat'],
				code: 'invalid_value',
				message: 'Invalid option: expected one of "pdf"|"png"'
			},
			20
		);

		expect(result).toEqual({
			code: 'SPEC_INVALID',
			field: 'outputFormat',
			message: 'Spec field failed validation.'
		});
	});

	it('classifies out-of-range item numbers regardless of the validator message text', () => {
		const result = mapValidationIssueToSpecValidationIssue(
			{
				path: ['spec', 'items', 0, 'number'],
				code: 'too_small',
				message: 'Too small: expected number to be >=1'
			},
			20
		);

		expect(result).toEqual({
			code: 'ITEM_NUMBER_OUT_OF_RANGE',
			field: 'items[0].number',
			message: 'Item number must be between 1 and 999.'
		});
	});
});
