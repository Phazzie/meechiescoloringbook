// Purpose: Turn one Meechie studio-text response into everything the verdict card shows — what she
//          said, how bad she says it is, whether she could rule on it at all, and what she said
//          would make it better.
// Why: The studio asks the provider for seven fields under a `strict: true` JSON schema and rendered
//      three. `qualityState` had no consumer anywhere in the application, so `blocked` — the model
//      stating it could not rule on this — looked exactly like a finished verdict, and the paid page
//      button was lit for it. `revisionNote` is defined in the prompt as "What you'd need to do this
//      better", is required on every call, is billed on every call, and reached no screen; the
//      reader was left to guess at it with three unlabelled rewrite buttons and a finite budget.
//      `rating` reached the screen as a bare "8/10" beside a verdict, where a severity reading of
//      the *situation* reads as a score of the *answer*.
// Info flow: MeechieStudioTextOutput (+ whether its standing was actually reported) ->
//            buildVerdictReport -> VerdictReport -> VerdictRow / StudioPreviewPanel.
// Invariants: Pure. No I/O, no clock, no third-party imports — the quality-state type comes in as a
//             type-only import, so nothing here pulls zod into the core.
//             Nothing in here infers a standing from the presence of text. A verdict rebuilt from a
//             stored page carries no standing of its own, and `standingWasReported: false` is how it
//             says so: the card then shows the words and says nothing about whether Meechie approved
//             them, rather than showing the `'ready'` that `buildStudioTextFromSpec` has to invent
//             to satisfy the contract's required field.

import type {
	MeechieStudioQualityState,
	MeechieStudioTextOutput
} from '$lib/seams/meechie-studio-text-seam/contract';

/**
 * The one definition of what each `qualityState` means.
 *
 * `promptGloss` is the parenthetical the *provider* is given; `sentence` is what the *reader* is
 * shown. They live in one table so the two can never disagree about what the value means — the
 * pipeline builds its prompt line from `promptGloss` rather than restating it beside this, which is
 * how the previous copy of the enum list got to sit three files away from the code that consumes it
 * and be consumed by nothing.
 */
type StudioQualityStateFacts = {
	/** Exactly the words inside the parentheses in the system prompt's field guide. */
	promptGloss: string;
	/** What the card says about this standing, in front of the reader. */
	sentence: string;
	/** Styling and urgency only. Carries no claim the sentence does not already make. */
	tone: 'ok' | 'caution' | 'stop';
	/** Whether the card offers to take the reader back to the evidence box. */
	invitesMore: boolean;
	/**
	 * The line beside the paid page button, or `null` when there is nothing to warn about.
	 *
	 * Deliberately not a reason to disable the button. The reader owns the decision — a model that
	 * over-uses `blocked` would otherwise switch the app off — and what they were owed was the
	 * warning, not the veto.
	 */
	pageCaution: string | null;
};

export const STUDIO_QUALITY_STATE_FACTS: Record<
	MeechieStudioQualityState,
	StudioQualityStateFacts
> = {
	ready: {
		promptGloss: 'enough to work with',
		sentence: 'Meechie had enough to work with.',
		tone: 'ok',
		invitesMore: false,
		pageCaution: null
	},
	needs_more_evidence: {
		promptGloss: 'need more tea',
		sentence: 'Meechie wants more before she calls it.',
		tone: 'caution',
		invitesMore: true,
		pageCaution:
			'Meechie asked for more before calling this one. A page made now prints the verdict as it stands.'
	},
	blocked: {
		promptGloss: "genuinely can't work with this",
		sentence: "Meechie could not rule on this one.",
		tone: 'stop',
		invitesMore: true,
		pageCaution:
			'Meechie could not rule on this one. A page made now prints what she said anyway.'
	}
};

/**
 * The order the states are listed in when the prompt enumerates them.
 *
 * Explicit rather than `Object.keys`, so the sentence the provider reads cannot be reordered by an
 * unrelated edit to the table above. A test asserts this covers the contract's enum exactly, which
 * is what stops a fourth state being added without anyone deciding what the reader is told about it.
 */
export const STUDIO_QUALITY_STATE_ORDER = [
	'ready',
	'needs_more_evidence',
	'blocked'
] as const satisfies readonly MeechieStudioQualityState[];

/**
 * The `qualityState` line in the system prompt's field guide, built from the table above.
 *
 * The prompt's bytes are load-bearing — changing them changes every generation in the app — so this
 * reproduces the line that was there, and a test pins it byte-for-byte. The point is not to reword
 * it; it is that the reader's sentence and the model's instruction now come from one row.
 */
export const buildStudioQualityStateGuidance = (): string =>
	STUDIO_QUALITY_STATE_ORDER.map(
		(state) => `${state} (${STUDIO_QUALITY_STATE_FACTS[state].promptGloss})`
	).join(', ');

/**
 * The enum values as a quoted union, the way the required-field list spells them: `"a" | "b"`.
 *
 * A function rather than an expression at the call site: inline it was a template literal inside a
 * template literal, which SonarCloud flags (`no-nested-template-literals`) and which is genuinely
 * harder to read. It also gives the test something to assert *against* — the first version of that
 * assertion pinned the string by recomputing it, which is a test agreeing with itself.
 */
export const buildStudioQualityStateUnion = (
	states: readonly string[] = STUDIO_QUALITY_STATE_ORDER
): string => states.map((state) => `"${state}"`).join(' | ');

/**
 * The enum values, as the prompt lists them in prose: `a, b, or c`.
 *
 * Takes the list rather than closing over it so the one-item case is reachable from a test. A naive
 * `slice(0, -1).join(', ')` renders a single state as ", or ready" — a sentence nobody would notice
 * was broken, in a prompt, where a broken sentence changes what the model returns.
 */
export const buildStudioQualityStateList = (
	states: readonly string[] = STUDIO_QUALITY_STATE_ORDER
): string => {
	if (states.length <= 1) return states.join('');
	return `${states.slice(0, -1).join(', ')}, or ${states[states.length - 1]}`;
};

/** How bad Meechie says the situation is. Never a judgement of her answer — see `meaning`. */
export type VerdictSeverity = {
	value: number;
	outOf: number;
	/** "Severity 8 of 10". The words matter: a bare "8/10" beside a verdict reads as a grade. */
	label: string;
	/** What the number is a reading of. Shown, not implied. */
	meaning: string;
	/** Styling band only. Adds no word to the screen, so it cannot over-claim. */
	weight: 'low' | 'mid' | 'high';
};

/** What Meechie said about whether she could answer at all. `null` when she never said. */
export type VerdictStanding = {
	code: MeechieStudioQualityState;
	sentence: string;
	tone: 'ok' | 'caution' | 'stop';
	invitesMore: boolean;
};

export type VerdictReport = {
	/** False only for a studio that has never had a verdict on it. */
	hasVerdict: boolean;
	/** The headline, or the idle line. */
	verdict: string;
	/** The quote, or the idle line. Rendered without quotation marks when there is no verdict. */
	quote: string;
	severity: VerdictSeverity | null;
	/**
	 * `null` means *nothing was reported*, not `'ready'`.
	 *
	 * A page reopened from a record saved before the studio stored its text has its words rebuilt
	 * from the page itself, and `buildStudioTextFromSpec` must put *some* value in the contract's
	 * required `qualityState` field to do that. Reading that invented `'ready'` as Meechie's own
	 * would put an approval on screen that she never gave, so provenance arrives as its own input.
	 */
	standing: VerdictStanding | null;
	/** `revisionNote`, trimmed. `null` when the provider sent none, or sent only whitespace. */
	note: string | null;
	/** The one line beside the paid page button, or `null`. */
	pageCaution: string | null;
};

/** What the card says with nothing on it. Here rather than in the markup so a test can read it. */
export const IDLE_VERDICT_HEADLINE = 'No verdict yet.';
/**
 * The idle quote line.
 *
 * The previous one — "Meechie will put the quote here after the AI text action runs" — named an
 * internal concept ("AI text action") that appears on no button and in no other sentence the reader
 * ever sees.
 */
export const IDLE_VERDICT_QUOTE = 'Tell her what happened and her take lands here.';

/**
 * The button on a standing that `invitesMore`.
 *
 * One label for both flagged states: what Meechie asked for is the same thing in each, and a second
 * wording would be a second copy of the same instruction.
 */
export const ADD_EVIDENCE_LABEL = 'Give her more evidence';

/** What the severity number is a reading of. One string, because it is the whole point of showing it. */
export const SEVERITY_MEANING =
	"Meechie's read on how bad the situation is — not a score for her answer.";

const severityWeight = (value: number): VerdictSeverity['weight'] => {
	if (value >= 8) return 'high';
	if (value >= 5) return 'mid';
	return 'low';
};

/**
 * The severity reading, or `null` when the response carried no rating.
 *
 * `null` renders as nothing at all. An absent rating is not a low one, and a card that fills the gap
 * with a zero, a dash or "unrated" would be describing a judgement Meechie did not make.
 */
export const readVerdictSeverity = (
	rating: number | undefined
): VerdictSeverity | null => {
	if (rating === undefined) return null;
	return {
		value: rating,
		outOf: 10,
		label: `Severity ${rating} of 10`,
		meaning: SEVERITY_MEANING,
		weight: severityWeight(rating)
	};
};

/**
 * Everything the verdict card shows, from one response.
 *
 * `standingWasReported` is separate from the output on purpose, and is the same shape of input as
 * Run 9's `promptWasSent` and Run 10's `driftChecked`: a required contract field always holds a
 * value, so the value alone can never say whether anybody actually reported it.
 */
export const buildVerdictReport = (input: {
	output: MeechieStudioTextOutput | null;
	standingWasReported: boolean;
}): VerdictReport => {
	const { output, standingWasReported } = input;
	if (!output) {
		return {
			hasVerdict: false,
			verdict: IDLE_VERDICT_HEADLINE,
			quote: IDLE_VERDICT_QUOTE,
			severity: null,
			standing: null,
			note: null,
			pageCaution: null
		};
	}

	const facts = standingWasReported
		? STUDIO_QUALITY_STATE_FACTS[output.qualityState]
		: null;
	// `NonEmptyStringSchema` is `.min(1)` and does not trim, so a `revisionNote` of three spaces is
	// contract-valid and would render as a labelled, empty box.
	const note = output.revisionNote?.trim();

	return {
		hasVerdict: true,
		verdict: output.verdict,
		quote: output.quote,
		severity: readVerdictSeverity(output.rating),
		standing: facts
			? {
					code: output.qualityState,
					sentence: facts.sentence,
					tone: facts.tone,
					invitesMore: facts.invitesMore
				}
			: null,
		note: note ? note : null,
		// Tied to the standing, not to the note: a caution is a statement about what Meechie reported,
		// and an unreported standing is not a reason to warn about anything.
		pageCaution: facts?.pageCaution ?? null
	};
};
