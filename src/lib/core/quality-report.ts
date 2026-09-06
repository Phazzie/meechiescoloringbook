// Purpose: Turn what the checks found about a generated page into what the reader is told about it
//          — the findings, their severity, the fixes that were computed alongside them, and the
//          difference between "checked and clean" and "never checked".
// Why: The drift and spec checks produce four things per generation: violations, their severity,
//      recommended fixes, and (inside the drift seam) a confidence score. The studio rendered one
//      and a half of them. `recommendedFixes` was held in two state classes and in the tools hub's
//      own local state, and written into vault records as `fixesApplied` — and shown to nobody in
//      any of the three; `severity` was flattened so a warning read
//      exactly like an error; and an empty violation list rendered as "No quality flags" whether
//      the page had passed its checks or did not exist yet. The panel's job is to say whether the
//      page matches what was asked for, and it could not distinguish silence from a clean bill.
// Info flow: GenerateResponse violations + recommendedFixes (+ spec-validation issues) -> buildQualityReport
//            -> QualityReport -> SystemTrace.svelte / VerdictPageStudio.svelte / MeechieTools.svelte.
//            All three surfaces, which is the point: they were three divergent renderings before.
// Invariants: Pure. No I/O, no clock, no randomness. Never claims a check passed that did not run:
//             `state: 'unchecked'` is a distinct value from `state: 'clean'`, and the caller says
//             which by passing `hasPage` and `driftChecked` as the two separate facts they are.
//             Violations and fixes are reported as two lists and never zipped into pairs — see
//             `QualityReport.fixes`. Every sentence here is scoped to what was actually inspected:
//             `detectDrift` reads `spec`, `promptSent` and `revisedPrompt` and never the generated
//             image, so nothing this module says may claim anything about the picture.

import type { DriftDetectionOutput, Violation } from '../../../contracts/drift-detection.contract';

// Derived from the output type rather than re-inferred from `RecommendedFixSchema`, so this file
// needs neither a second import of the contract nor a dependency on `zod` to name one of its types.
type RecommendedFix = DriftDetectionOutput['recommendedFixes'][number];

/** Why the drift check returned no verdict — the shape `/api/generate` reports it in. */
export type DriftCheckFailure = { code: string; message: string };

/**
 * The finding code for a page whose stored check result is missing rather than empty.
 *
 * Not a wire value and never sent by the server: this is synthesized here for a reopened vault
 * record whose findings are not on file. Such a record has a page and nothing that distinguishes
 * "checked, clean" from "the check failed and nothing was stored" — a result that is *unknown*, and
 * unknown must not render as clean.
 */
export const CHECK_RESULT_UNRECORDED_CODE = 'CHECK_RESULT_UNRECORDED';

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
	/**
	 * Which check said so, because the two are about different things and must not be counted
	 * together.
	 *
	 * `settings` is a spec-validation issue: the request on screen is invalid, and there may be no
	 * page at all — in fact that is usually why. `prompt` is a drift finding: a requirement did not
	 * survive into the prompt that was sent. Summing them as "things the page got wrong" told a
	 * reader with an over-long dedication and no page that their nonexistent page had failed.
	 */
	source: 'settings' | 'prompt';
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

const weighViolation = (violation: Violation): QualityFinding['weight'] =>
	violation.severity === 'warning' ? 'note' : 'blocker';

/**
 * Build the report for the page on the paper.
 *
 * `hasPage` and `driftChecked` are two arguments rather than one because they are two facts, and
 * the first draft of this module collapsed them — it took a single `hasGeneratedPage` and was
 * handed the check-completion flag for it. That was wrong in both directions at once, which is what
 * collapsing two facts into one always costs:
 *
 * - A generation that returns a contract-valid success with `images: []` and no violations has been
 *   checked but produced no page. Reading the check flag as page presence made it `clean` — "the
 *   page came back exactly as asked" — beside a generation error saying no picture came back.
 * - A vault record saved before findings were persisted has a page and no stored `violations`.
 *   Reading page presence off the check flag made it `unchecked` — "nothing on the paper yet" —
 *   about a page the reader was looking at.
 *
 * So: `hasPage` is whether there is a picture, `driftChecked` is whether the check reported on it,
 * and neither is inferred from the other.
 */
export const buildQualityReport = (input: {
	/** True when there is a generated image on screen. */
	hasPage: boolean;
	/** True when the drift check reported on the page currently on screen. */
	driftChecked: boolean;
	violations: readonly Violation[];
	recommendedFixes: readonly RecommendedFix[];
	/**
	 * Why the drift check returned no verdict, straight from `/api/generate`.
	 *
	 * Present means `violations` is empty because nothing was graded, not because nothing was
	 * wrong. Carried as its own field rather than as a reserved code inside `violations`, so the
	 * distinction is in the contract every consumer reads instead of in a string only this module
	 * knows how to interpret.
	 */
	driftCheckFailure?: DriftCheckFailure;
	/**
	 * True when the page on screen came from a stored record whose check result is not on file.
	 *
	 * Passed in explicitly rather than inferred from `hasPage && !driftChecked`, which is what the
	 * first version did and which was wrong for a whole flow: a wig try-on page is installed without
	 * ever calling `/api/generate`, so it has a page and no drift result and had never been saved —
	 * and got told it "was saved before its check result was recorded". Only the caller knows a page
	 * came out of the vault, so only the caller says so.
	 */
	checkResultUnrecorded?: boolean;
	/**
	 * Spec-validation issues, which are about the request rather than the result.
	 *
	 * Optional because the mode routes do not run a separate spec check the way the home studio
	 * does. They are folded in as blockers: a spec that failed its own contract is a page that was
	 * never going to match what was asked for.
	 *
	 * These are the one thing `hasPage` does *not* gate, and deliberately. A failing spec check is a
	 * fact about the settings on screen right now, not about a past generation — in fact it is the
	 * reason there is no page, since the studio refuses to generate while it holds any. Gating them
	 * would have hidden a live, fixable complaint behind the absence of the very thing the complaint
	 * is preventing.
	 */
	validationIssues?: readonly { field: string; message: string }[];
}): QualityReport => {
	const findings: QualityFinding[] = (input.validationIssues ?? []).map((issue) => ({
		code: issue.field,
		message: issue.message,
		weight: 'blocker' as const,
		source: 'settings' as const
	}));

	if (input.driftChecked) {
		for (const violation of input.violations) {
			findings.push({
				code: violation.code,
				message: violation.message,
				weight: weighViolation(violation),
				source: 'prompt'
			});
		}
	}

	if (input.driftCheckFailure) {
		findings.push({
			code: input.driftCheckFailure.code,
			message: `The prompt could not be checked against what was asked for: ${input.driftCheckFailure.message}`,
			weight: 'check-failed',
			source: 'prompt'
		});
	} else if (input.checkResultUnrecorded) {
		// A page whose check result is not on file. Distinct from a failed check and from a clean
		// one, and it must not borrow either's wording.
		findings.push({
			code: CHECK_RESULT_UNRECORDED_CODE,
			message: "This page's check result is not on file, so there is nothing to report about it.",
			weight: 'check-failed',
			source: 'prompt'
		});
	}

	if (findings.length > 0) {
		// A stable sort by weight: `Array.prototype.sort` is required to be stable, so findings of
		// equal weight stay in the order the checkers reported them rather than in an order this
		// module made up.
		const ordered = [...findings].sort((a, b) => WEIGHT_ORDER[a.weight] - WEIGHT_ORDER[b.weight]);
		return {
			state: 'flagged',
			findings: ordered,
			// Gated on the check having run, which is what the fixes answer. A check that did not
			// report has no remedies to offer, whatever is on the paper.
			fixes: input.driftChecked ? input.recommendedFixes.map((fix) => fix.message) : [],
			hasIncompleteCheck: ordered.some((finding) => finding.weight === 'check-failed')
		};
	}

	// No findings. `clean` requires both halves: a page to be clean about, and a check that looked at
	// it. Missing either one is `unchecked`, which says nothing rather than something untrue.
	return input.hasPage && input.driftChecked ? { state: 'clean' } : { state: 'unchecked' };
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
		// Deliberately about the prompt, not the page. `detectDrift` is handed `spec`, `promptSent`
		// and `revisedPrompt` and reads nothing else — the adapter never sees the generated image. So
		// a clean result proves every requirement survived into the prompt that was sent; it proves
		// nothing about whether the provider then drew them. The earlier wording, "The page came back
		// exactly as asked", claimed the second from evidence for the first, which is the same species
		// of overclaim this module exists to remove.
		return 'Everything asked for made it into the prompt.';
	}

	const settingsBlockers = report.findings.filter(
		(finding) => finding.source === 'settings' && finding.weight === 'blocker'
	).length;
	const promptBlockers = report.findings.filter(
		(finding) => finding.source === 'prompt' && finding.weight === 'blocker'
	).length;
	const notes = report.findings.filter((finding) => finding.weight === 'note').length;

	const parts: string[] = [];
	if (settingsBlockers > 0) {
		// Counted apart from prompt findings, and worded as the request rather than the result: a
		// spec-validation issue is usually why there is no page at all, so calling it something "the
		// page got wrong" reported a failure of a page that does not exist.
		parts.push(`${settingsBlockers} ${settingsBlockers === 1 ? 'setting' : 'settings'} to fix`);
	}
	if (promptBlockers > 0) {
		parts.push(`${promptBlockers} ${promptBlockers === 1 ? 'thing' : 'things'} the prompt dropped`);
	}
	if (notes > 0) {
		parts.push(`${notes} worth noting`);
	}
	if (report.hasIncompleteCheck) {
		parts.push('one check that never finished');
	}

	// `parts` cannot be empty: `flagged` guarantees a non-empty `findings`, and every finding is
	// counted by exactly one of the four branches above.
	return `${formatList(parts)}.`;
};

/** "a", "a and b", "a, b and c" — the serial comma left out to match the rest of the studio's copy. */
const formatList = (parts: string[]): string => {
	// Every caller reaches here from a `flagged` report, which guarantees a non-empty `parts`. The
	// `?? ''` keeps that a typed fallback rather than a non-null assertion — an empty tail would
	// read as a missing clause, which is visible, where `!` would be a claim the compiler cannot
	// check.
	const last = parts.at(-1) ?? '';
	if (parts.length === 1) {
		return capitalize(last);
	}
	const head = parts.slice(0, -1).join(', ');
	return capitalize(`${head} and ${last}`);
};

const capitalize = (text: string): string => text.charAt(0).toUpperCase() + text.slice(1);
