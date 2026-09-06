// Purpose: Turn what the checks found about a generated page into what the reader is told about it
//          — the findings, their severity, the fixes that were computed alongside them, and the
//          difference between "checked and clean" and "never checked".
// Why: The drift and spec checks produce four things per generation: violations, their severity,
//      recommended fixes, and (inside the drift seam) a confidence score. The studio rendered one
//      and a half of them. `recommendedFixes` was stored in two state classes and written into
//      vault records without ever being shown to anyone; `severity` was flattened so a warning read
//      exactly like an error; and an empty violation list rendered as "No quality flags" whether
//      the page had passed its checks or did not exist yet. The panel's job is to say whether the
//      page matches what was asked for, and it could not distinguish silence from a clean bill.
// Info flow: GenerateResponse violations + recommendedFixes (+ spec-validation issues) -> buildQualityReport
//            -> QualityReport -> SystemTrace.svelte / VerdictPageStudio.svelte.
// Invariants: Pure. No I/O, no clock, no randomness. Never claims a page passed a check that did not
//             run: `state: 'unchecked'` is a distinct value from `state: 'clean'`, and the caller
//             must say which by passing `hasGeneratedPage`. Violations and fixes are reported as two
//             lists and never zipped into pairs — see `QualityReport.fixes`.

import type { Violation } from '../../../contracts/drift-detection.contract';
import type { RecommendedFixSchema } from '../../../contracts/drift-detection.contract';
import type { z } from 'zod';

type RecommendedFix = z.infer<typeof RecommendedFixSchema>;

/**
 * The violation code the generate pipeline emits when the drift check itself could not return a
 * verdict.
 *
 * The drift seam reports a prompt so malformed it will not grade the rest — a missing required
 * section — as `{ ok: false }` rather than as a violation. The pipeline used to map that to
 * `violations: []`, so the single most serious thing the checker can find arrived at the studio
 * looking exactly like a page with nothing wrong with it. The pipeline now emits this code instead,
 * carrying the seam's own code and message in the text.
 *
 * Defined here, in the dependency-free core, and imported by both the pipeline that writes it and
 * the report that reads it. Two string literals in two files is a second copy of one truth, and the
 * copy goes stale silently — a report that stops recognising the code does not fail, it just
 * quietly starts calling a failed check a drift finding again.
 */
export const DRIFT_CHECK_FAILED_CODE = 'DRIFT_CHECK_FAILED';

/** One thing a check found wrong, in the reader's words rather than the checker's. */
export type QualityFinding = {
	/** The checker's code. Kept for tests and `data-` attributes; never rendered as prose. */
	code: string;
	/** The sentence shown to the reader. */
	message: string;
	/**
	 * How much it matters. `blocker` is a drift `error`, `note` is a drift `warning`, and
	 * `check-failed` is the check not completing — which is neither, because an incomplete check
	 * says nothing about the page either way.
	 */
	weight: 'blocker' | 'note' | 'check-failed';
};

/**
 * What the checks have to say about the page currently on the paper.
 *
 * `state` is the discriminator the UI switches on, and the three values are deliberately not
 * collapsible into "is the findings array empty":
 * - `unchecked`: there is no page, so nothing has been checked. The panel must say nothing rather
 *   than say it is clean.
 * - `clean`: a page was generated and every check returned with nothing to report.
 * - `flagged`: at least one check found something, or at least one check could not finish.
 */
export type QualityReport =
	| { state: 'unchecked' }
	| { state: 'clean' }
	| {
			state: 'flagged';
			/** Findings, most serious first. Never empty when `state` is `flagged`. */
			findings: QualityFinding[];
			/**
			 * The remedies the drift seam computed, as its own list.
			 *
			 * Deliberately *not* paired with `findings`. The seam pushes a fix alongside most
			 * violations, so index `n` of each list usually corresponds — but "usually" is the whole
			 * problem. `DriftDetectionOutputSchema` declares two independent arrays and guarantees
			 * no ordering, no equal length, and no shared key: the codes differ by design
			 * (`MISSING_PAGE_SIZE` against `ADD_PAGE_SIZE`), and two of the violation branches
			 * append a violation per offending line while the reader sees one heading. Zipping them
			 * by index would render a remedy under a finding it does not belong to, and it would do
			 * it silently and only sometimes. Mapping code-to-code would be a third copy of a
			 * pairing the contract never made. So the report shows the two lists as the two lists
			 * they are, and asserts nothing about which fix answers which finding.
			 */
			fixes: string[];
			/** True when one of the findings is a check that did not complete. */
			hasIncompleteCheck: boolean;
	  };

/** The ordering the panel reads in: what stops the page, then what did not finish, then remarks. */
const WEIGHT_ORDER: Record<QualityFinding['weight'], number> = {
	blocker: 0,
	'check-failed': 1,
	note: 2
};

const weighViolation = (violation: Violation): QualityFinding['weight'] => {
	if (violation.code === DRIFT_CHECK_FAILED_CODE) {
		return 'check-failed';
	}
	return violation.severity === 'warning' ? 'note' : 'blocker';
};

/**
 * Build the report for the page on the paper.
 *
 * `hasGeneratedPage` is a required argument rather than something inferred from the arrays, because
 * it is the one fact the arrays cannot carry: an empty `violations` means "nothing found" for a page
 * that exists and "nothing asked" for a page that does not, and those are opposite claims. The
 * caller knows which — it is holding the images — so it says so.
 */
export const buildQualityReport = (input: {
	hasGeneratedPage: boolean;
	violations: readonly Violation[];
	recommendedFixes: readonly RecommendedFix[];
	/**
	 * Spec-validation issues, which are about the request rather than the result.
	 *
	 * Optional because the mode routes do not run a separate spec check the way the home studio
	 * does. They are folded in as blockers: a spec that failed its own contract is a page that was
	 * never going to match what was asked for.
	 *
	 * These are the one thing `hasGeneratedPage` does *not* gate, and deliberately. A failing spec
	 * check is a fact about the settings on screen right now, not about a past generation — in fact
	 * it is the reason there is no page, since the studio refuses to generate while it holds any.
	 * Gating them would have hidden a live, fixable complaint behind the absence of the very thing
	 * the complaint is preventing.
	 */
	validationIssues?: readonly { field: string; message: string }[];
}): QualityReport => {
	const specFindings: QualityFinding[] = (input.validationIssues ?? []).map((issue) => ({
		code: issue.field,
		message: issue.message,
		weight: 'blocker' as const
	}));

	if (!input.hasGeneratedPage && specFindings.length === 0) {
		return { state: 'unchecked' };
	}

	const findings: QualityFinding[] = [
		...specFindings,
		...(input.hasGeneratedPage
			? input.violations.map((violation) => ({
					code: violation.code,
					message: violation.message,
					weight: weighViolation(violation)
				}))
			: [])
	];

	if (findings.length === 0) {
		return { state: 'clean' };
	}

	// A stable sort by weight: `Array.prototype.sort` is required to be stable, so findings of equal
	// weight stay in the order the checkers reported them rather than in an order this module made up.
	const ordered = [...findings].sort((a, b) => WEIGHT_ORDER[a.weight] - WEIGHT_ORDER[b.weight]);

	return {
		state: 'flagged',
		findings: ordered,
		// Gated on the same fact as the violations they answer: the fixes come from the drift seam,
		// so with no page there is no drift run and nothing they could be remedies for.
		fixes: input.hasGeneratedPage ? input.recommendedFixes.map((fix) => fix.message) : [],
		hasIncompleteCheck: ordered.some((finding) => finding.weight === 'check-failed')
	};
};

/**
 * The one line the panel leads with, in Meechie's voice: a statement of what is, not a diagnosis.
 *
 * Returns `null` for `unchecked` — there is no page, so there is nothing to say about one, and
 * saying so anyway is how the old panel came to report a clean bill for a blank studio.
 */
export const describeQualityReport = (report: QualityReport): string | null => {
	if (report.state === 'unchecked') {
		return null;
	}
	if (report.state === 'clean') {
		return 'The page came back exactly as asked.';
	}

	const blockers = report.findings.filter((finding) => finding.weight === 'blocker').length;
	const notes = report.findings.filter((finding) => finding.weight === 'note').length;

	const parts: string[] = [];
	if (blockers > 0) {
		parts.push(`${blockers} ${blockers === 1 ? 'thing' : 'things'} the page got wrong`);
	}
	if (notes > 0) {
		parts.push(`${notes} worth noting`);
	}
	if (report.hasIncompleteCheck) {
		parts.push('one check that never finished');
	}

	// `parts` cannot be empty: `flagged` guarantees a non-empty `findings`, and every finding is
	// counted by exactly one of the three branches above.
	return `${formatList(parts)}.`;
};

/** "a", "a and b", "a, b and c" — the serial comma left out to match the rest of the studio's copy. */
const formatList = (parts: string[]): string => {
	if (parts.length === 1) {
		return capitalize(parts[0]);
	}
	const head = parts.slice(0, -1).join(', ');
	return capitalize(`${head} and ${parts[parts.length - 1]}`);
};

const capitalize = (text: string): string => text.charAt(0).toUpperCase() + text.slice(1);
