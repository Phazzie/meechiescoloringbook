// Purpose: Adapter implementation for SpecValidationSeam.
// Why: Enforce spec constraints deterministically before downstream work.
// Info flow: Raw spec -> validation issues -> decision gating.
import { mapValidationIssueToSpecValidationIssue } from '../../core/spec-validation-issue-mapping';
import type { ValidationIssueLike } from '../../core/spec-validation-issue-mapping';
import {
	ColoringPageSpecSchema,
	MAX_SPEC_ITEMS,
	SpecValidationInputSchema,
	SpecValidationIssueSchema
} from '../../seams/spec-validation-seam/contract';
import type {
	SpecValidationInput,
	SpecValidationOutput,
	SpecValidationSeam
} from '../../seams/spec-validation-seam/contract';

const issueFromZod = (issue: ValidationIssueLike) =>
	mapValidationIssueToSpecValidationIssue(issue, MAX_SPEC_ITEMS);

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
