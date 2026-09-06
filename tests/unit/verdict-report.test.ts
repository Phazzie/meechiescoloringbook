/*
 * Purpose: Cover the pure verdict-card transform — the standing, the severity reading, the note, the
 *          page caution, and the prompt lines built from the same table the reader is shown.
 * Why: `qualityState` and `revisionNote` were required of the provider on every call and rendered
 *      nowhere, so no test in this repository had ever constructed a `needs_more_evidence` or a
 *      `blocked` response. Every fixture and every existing test used `'ready'`.
 * Info flow: buildVerdictReport(output, standingWasReported) -> VerdictReport assertions.
 * Invariants: The prompt-line assertions are byte pins. The prompt's wording drives every generation
 *             in the app, so rebuilding those lines from the table must not have changed them.
 */
import { describe, expect, it } from 'vitest';
import {
	IDLE_VERDICT_HEADLINE,
	IDLE_VERDICT_QUOTE,
	SEVERITY_MEANING,
	STUDIO_QUALITY_STATE_FACTS,
	STUDIO_QUALITY_STATE_ORDER,
	buildStudioQualityStateGuidance,
	buildStudioQualityStateList,
	buildStudioQualityStateUnion,
	buildVerdictReport,
	readVerdictSeverity,
	warrantForRestoredVerdict
} from '$lib/core/verdict-report';
import {
	MeechieStudioQualityStateSchema,
	type MeechieStudioQualityState,
	type MeechieStudioTextOutput
} from '$lib/seams/meechie-studio-text-seam/contract';

const outputWith = (
	overrides: Partial<MeechieStudioTextOutput> = {}
): MeechieStudioTextOutput => ({
	verdict: 'The phone did not die. The effort did.',
	quote: 'A dead phone with a live story is still a confession.',
	pageTitle: 'THE PHONE HAD SERVICE',
	pageItems: [
		{ number: 1, label: 'CHECK THE TIMESTAMP' },
		{ number: 2, label: 'BELIEVE THE POST' }
	],
	rating: 8,
	qualityState: 'ready',
	revisionNote: 'Give me the date and I get sharper.',
	...overrides
});

const reportFor = (
	overrides: Partial<MeechieStudioTextOutput> = {},
	standingWasReported = true
) =>
	buildVerdictReport({ output: outputWith(overrides), standingWasReported });

describe('the standing table', () => {
	it('covers exactly the states the contract accepts', () => {
		// The guard that stops a fourth `qualityState` being added to the contract without anyone
		// deciding what the reader is told about it. The zod schema is imported here rather than in
		// the module itself: core may not depend on third-party libraries.
		expect([...STUDIO_QUALITY_STATE_ORDER].sort()).toEqual(
			[...MeechieStudioQualityStateSchema.options].sort()
		);
		expect(Object.keys(STUDIO_QUALITY_STATE_FACTS).sort()).toEqual(
			[...MeechieStudioQualityStateSchema.options].sort()
		);
	});

	it('gives every state a sentence, and a caution only where there is something to warn about', () => {
		for (const state of STUDIO_QUALITY_STATE_ORDER) {
			const facts = STUDIO_QUALITY_STATE_FACTS[state];
			expect(facts.sentence.trim().length).toBeGreaterThan(0);
			expect(facts.promptGloss.trim().length).toBeGreaterThan(0);
		}
		expect(STUDIO_QUALITY_STATE_FACTS.ready.pageCaution).toBeNull();
		expect(STUDIO_QUALITY_STATE_FACTS.needs_more_evidence.pageCaution).not.toBeNull();
		expect(STUDIO_QUALITY_STATE_FACTS.blocked.pageCaution).not.toBeNull();
	});

	it('rebuilds the system prompt lines byte-for-byte', () => {
		// These three strings were literals in `meechie-studio-text-pipeline.ts` before this change.
		// They are pinned here, not paraphrased: the prompt's bytes decide what every generation in
		// the app produces, and this refactor was supposed to change none of them.
		expect(buildStudioQualityStateGuidance()).toBe(
			"ready (enough to work with), needs_more_evidence (need more tea), blocked (genuinely can't work with this)"
		);
		expect(buildStudioQualityStateList()).toBe('ready, needs_more_evidence, or blocked');
		// The shapes a shrunken enum would produce, so the prose stays a sentence either way.
		expect(buildStudioQualityStateList(['ready', 'blocked'])).toBe('ready, or blocked');
		expect(buildStudioQualityStateList(['ready'])).toBe('ready');
		expect(buildStudioQualityStateList([])).toBe('');
		expect(buildStudioQualityStateUnion()).toBe(
			'"ready" | "needs_more_evidence" | "blocked"'
		);
		expect(buildStudioQualityStateUnion(['ready'])).toBe('"ready"');
	});
});

describe('warrantForRestoredVerdict', () => {
	// `modelMetadata` is a provenance *stamp*, not a shape heuristic: `parseProviderText` attaches it
	// to every accepted studio-provider response in the pipeline, and neither producer that has to
	// invent a `qualityState` can produce one.
	it('believes a record carrying the provider stamp', () => {
		expect(
			warrantForRestoredVerdict({
				modelMetadata: { provider: 'xai', model: 'grok' }
			})
		).toBe('reported');
	});

	it('does not believe a record without it, and does not doubt it aloud either', () => {
		// A toolkit page, or a studio page written before the stamp existed. The words are kept and
		// written back; only the claim is withheld.
		expect(warrantForRestoredVerdict({ modelMetadata: undefined })).toBe('stored');
	});

	it('treats a record that stored no text at all as derived', () => {
		expect(warrantForRestoredVerdict(undefined)).toBe('derived');
	});
});

describe('buildVerdictReport with no verdict', () => {
	const idle = buildVerdictReport({ output: null, standingWasReported: false });

	it('says there is nothing, and says nothing else', () => {
		expect(idle.hasVerdict).toBe(false);
		expect(idle.verdict).toBe(IDLE_VERDICT_HEADLINE);
		expect(idle.quote).toBe(IDLE_VERDICT_QUOTE);
		expect(idle.severity).toBeNull();
		expect(idle.standing).toBeNull();
		expect(idle.note).toBeNull();
		expect(idle.pageCaution).toBeNull();
	});

	it('keeps internal vocabulary out of the idle line', () => {
		// "after the AI text action runs" named a concept that appears on no button in the app.
		expect(IDLE_VERDICT_QUOTE.toLowerCase()).not.toContain('ai text action');
	});

	it('reports nothing even when told the standing was reported', () => {
		const contradictory = buildVerdictReport({
			output: null,
			standingWasReported: true
		});
		expect(contradictory.standing).toBeNull();
		expect(contradictory.pageCaution).toBeNull();
	});
});

describe('buildVerdictReport standing', () => {
	it('carries what Meechie said for each state she can report', () => {
		for (const state of STUDIO_QUALITY_STATE_ORDER) {
			const report = reportFor({ qualityState: state });
			expect(report.standing).not.toBeNull();
			expect(report.standing?.code).toBe(state);
			expect(report.standing?.sentence).toBe(
				STUDIO_QUALITY_STATE_FACTS[state].sentence
			);
			expect(report.pageCaution).toBe(
				STUDIO_QUALITY_STATE_FACTS[state].pageCaution
			);
		}
	});

	it('does not distinguish a blocked verdict by hiding it', () => {
		// The words stay on screen. What changes is that the card stops presenting them as a ruling.
		const report = reportFor({ qualityState: 'blocked' });
		expect(report.hasVerdict).toBe(true);
		expect(report.verdict).toBe(outputWith().verdict);
		expect(report.quote).toBe(outputWith().quote);
		expect(report.standing?.tone).toBe('stop');
		expect(report.standing?.invitesMore).toBe(true);
	});

	it('offers the way back to the evidence box only where more evidence is the answer', () => {
		expect(reportFor({ qualityState: 'ready' }).standing?.invitesMore).toBe(false);
		expect(
			reportFor({ qualityState: 'needs_more_evidence' }).standing?.invitesMore
		).toBe(true);
	});

	it('says nothing about a standing nobody reported, whatever the field holds', () => {
		// The heart of it: `buildStudioTextFromSpec` has to write *some* value into the contract's
		// required `qualityState` to rebuild a legacy record's words, and it writes `'ready'`.
		// Reading that as Meechie's own approval is the defect this input exists to prevent.
		for (const state of STUDIO_QUALITY_STATE_ORDER) {
			const report = reportFor({ qualityState: state }, false);
			expect(report.standing).toBeNull();
			expect(report.pageCaution).toBeNull();
			// The words themselves are still hers, and still shown.
			expect(report.verdict).toBe(outputWith().verdict);
		}
	});
});

describe('buildVerdictReport severity', () => {
	it('labels the number as severity, and says what it is a reading of', () => {
		const severity = reportFor({ rating: 8 }).severity;
		expect(severity?.value).toBe(8);
		expect(severity?.outOf).toBe(10);
		expect(severity?.label).toBe('Severity 8 of 10');
		expect(severity?.meaning).toBe(SEVERITY_MEANING);
		// The point of the sentence: it says which of the two possible readings this number is.
		expect(SEVERITY_MEANING).toContain('not a score for her answer');
	});

	it('says nothing about a score that is already the headline', () => {
		// Rate This Excuse builds its headline as "N/10" and scores an excuse's *credibility* — 1 is
		// insulting, 10 is barely credible — which is close to the opposite of situation severity.
		// `buildToolStudioText` no longer copies that number into the studio's `rating`, but records
		// saved before that fix still carry it, and the card must not print it twice with the second
		// copy relabelled. Derived from the record's own two fields, not matched against a list of
		// tools: the question is whether this card would say the same number twice.
		expect(readVerdictSeverity(2, '2/10')).toBeNull();
		expect(readVerdictSeverity(2, '  2/10  ')).toBeNull();
		expect(reportFor({ rating: 2, verdict: '2/10' }, false).severity).toBeNull();
		// A headline that merely mentions the number is not the number.
		expect(readVerdictSeverity(2, 'He scored 2/10 on effort')?.value).toBe(2);
		// And a real verdict beside a real severity is untouched.
		expect(readVerdictSeverity(8, 'The phone did not die.')?.label).toBe('Severity 8 of 10');
	});

	it('still labels a live response whose verdict happens to be the score', () => {
		// Codex's correction to the guard above. The guard exists for records written before
		// `buildToolStudioText` stopped copying a tool score into this field, and those are restored
		// by definition. A live `rating` is a studio severity by construction, so suppressing the
		// label there would leave the bare, unexplained "8/10" this whole change exists to stop
		// showing — and a redundant true label beats an unexplained number.
		const live = reportFor({ rating: 8, verdict: '8/10' }, true);
		expect(live.severity?.label).toBe('Severity 8 of 10');
		expect(live.severity?.meaning).toBe(SEVERITY_MEANING);

		// The same response restored from a record is the case the guard is for.
		expect(reportFor({ rating: 8, verdict: '8/10' }, false).severity).toBeNull();
	});

	it('reports nothing at all when the response carried no rating', () => {
		// Not a zero, not a dash, not "unrated". An absent rating is not a low one.
		expect(reportFor({ rating: undefined }).severity).toBeNull();
		expect(readVerdictSeverity(undefined)).toBeNull();
	});

	it('bands the whole 1-10 range with no gap', () => {
		const weights = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(
			(value) => readVerdictSeverity(value)?.weight
		);
		expect(weights).toEqual([
			'low',
			'low',
			'low',
			'low',
			'mid',
			'mid',
			'mid',
			'high',
			'high',
			'high'
		]);
	});

	it('survives a rating and a standing being independent', () => {
		const report = reportFor({ rating: 2, qualityState: 'blocked' });
		expect(report.severity?.value).toBe(2);
		expect(report.standing?.code).toBe('blocked');
	});
});

describe('buildVerdictReport note', () => {
	it('carries the revision note the provider is charged for on every call', () => {
		expect(reportFor().note).toBe('Give me the date and I get sharper.');
	});

	it('is null when the provider sent none', () => {
		expect(reportFor({ revisionNote: undefined }).note).toBeNull();
	});

	it('is null when the provider sent only whitespace', () => {
		// `NonEmptyStringSchema` is `z.string().min(1)` and does not trim, so this passes validation
		// and would otherwise render as a labelled empty box.
		expect(reportFor({ revisionNote: '   ' }).note).toBeNull();
		expect(reportFor({ revisionNote: '\n\t ' }).note).toBeNull();
	});

	it('trims a note rather than dropping it', () => {
		expect(reportFor({ revisionNote: '  Name the date.  ' }).note).toBe('Name the date.');
	});

	it('is shown independently of the standing', () => {
		// A note on a `ready` verdict is still what she would need to do it better. It is not an
		// error message, and gating it on a flagged standing would hide it on the common path.
		const state: MeechieStudioQualityState = 'ready';
		expect(reportFor({ qualityState: state }).note).toBe(
			'Give me the date and I get sharper.'
		);
	});

	it('survives an unreported standing, because it is not a standing', () => {
		// A note only exists on a response, and a response with a note reported its own state too —
		// but the two inputs are independent, and the note must not vanish with the standing.
		expect(reportFor({}, false).note).toBe('Give me the date and I get sharper.');
	});
});
