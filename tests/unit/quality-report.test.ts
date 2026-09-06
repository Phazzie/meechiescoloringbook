// Purpose: Cover the quality report transforms — the empty/clean distinction, severity weighting,
//          the failed-check finding, ordering, and the deliberate refusal to pair fixes to findings.
// Why: This module exists because the old panel could not tell "checked and clean" from "never
//      checked" and threw away severity and every recommended fix. Each of those is a named test
//      here so a later change cannot quietly restore any of them.
// Info flow: buildQualityReport / describeQualityReport inputs -> asserted report shape and sentence.
import { describe, expect, it } from 'vitest';
import {
	CHECK_RESULT_UNRECORDED_CODE,
	buildQualityReport,
	describeQualityReport
} from '../../src/lib/core/quality-report';
import type { Violation } from '../../contracts/drift-detection.contract';

const blocker = (message: string, code = 'MISSING_OPTION_LINE'): Violation => ({
	code,
	message,
	severity: 'error'
});

const warning = (message: string, code = 'FORBIDDEN_HEADING'): Violation => ({
	code,
	message,
	severity: 'warning'
});

describe('buildQualityReport', () => {
	it('reports "unchecked" when no page has been generated, rather than clean', () => {
		const report = buildQualityReport({
			hasPage: false,
			driftChecked: false,
			violations: [],
			recommendedFixes: []
		});

		// The defect this module was built for: an empty violation list on a studio that had never
		// generated anything used to render as "No quality flags", the same sentence a page that
		// passed every check got.
		expect(report.state).toBe('unchecked');
		expect(describeQualityReport(report)).toBeNull();
	});

	it('reports "clean" only when a page exists and every check came back empty', () => {
		const report = buildQualityReport({
			hasPage: true,
			driftChecked: true,
			violations: [],
			recommendedFixes: []
		});

		expect(report.state).toBe('clean');
		expect(describeQualityReport(report)).toBe(
			'The prompt carried every constraint this check covers.'
		);
	});

	it('keeps an error and a warning apart instead of flattening them', () => {
		const report = buildQualityReport({
			hasPage: true,
			driftChecked: true,
			violations: [warning('Remove heading: EXTRA:'), blocker('Missing option line: Border: thin.')],
			recommendedFixes: []
		});

		if (report.state !== 'flagged') throw new Error('expected a flagged report');
		expect(report.findings.map((finding) => finding.weight)).toEqual(['blocker', 'note']);
	});

	it('orders blockers first, then an incomplete check, then notes', () => {
		const report = buildQualityReport({
			hasPage: true,
			driftChecked: true,
			violations: [warning('a note'), blocker('a real problem')],
			recommendedFixes: [],
			driftCheckFailure: { code: 'MISSING_REQUIRED_SECTION', message: 'no STYLE: heading' }
		});

		if (report.state !== 'flagged') throw new Error('expected a flagged report');
		// The failure is a blocker too — the seam named the missing heading — so it sorts with the
		// other blockers rather than into a category of its own.
		expect(report.findings.map((finding) => finding.weight)).toEqual([
			'blocker',
			'blocker',
			'note'
		]);
	});

	it('preserves reporter order among findings of equal weight', () => {
		const report = buildQualityReport({
			hasPage: true,
			driftChecked: true,
			violations: [blocker('first'), blocker('second'), blocker('third')],
			recommendedFixes: []
		});

		if (report.state !== 'flagged') throw new Error('expected a flagged report');
		expect(report.findings.map((finding) => finding.message)).toEqual([
			'first',
			'second',
			'third'
		]);
	});

	it('reports a named missing heading as a blocker, not as an unknown state', () => {
		// The seam's only `{ ok: false }` is `MISSING_REQUIRED_SECTION`, where it has identified the
		// exact missing heading — a detected defect, and the most serious one it reports. Filing it
		// as "the check did not finish" stripped its severity and offered no remedy: the worst
		// finding rendered as the least informative state, which is the original defect one notch
		// over.
		const report = buildQualityReport({
			hasPage: true,
			driftChecked: false,
			violations: [],
			recommendedFixes: [],
			driftCheckFailure: {
				code: 'MISSING_REQUIRED_SECTION',
				message: 'Required section missing: STYLE:'
			}
		});

		if (report.state !== 'flagged') throw new Error('expected a flagged report');
		expect(report.findings[0].weight).toBe('blocker');
		expect(report.findings[0].source).toBe('prompt');
		expect(report.findings[0].message).toContain('Required section missing: STYLE:');
		// The incompleteness is still reported — it is just carried alongside the blocker instead of
		// replacing it.
		expect(report.findings[0].message).toContain('the rest of the prompt was not compared');
		expect(report.hasIncompleteCheck).toBe(true);
		expect(describeQualityReport(report)).toBe(
			'1 thing wrong with the prompt and the check stopped before the rest.'
		);
	});

	it('does not call a picture-less generation clean, however the check came back', () => {
		// Codex's case: `/api/generate` can return a contract-valid success with `images: []` and no
		// violations. Reading check-completion as page-presence reported "the page came back exactly
		// as asked" beside a generation error saying no picture came back.
		const report = buildQualityReport({
			hasPage: false,
			driftChecked: true,
			violations: [],
			recommendedFixes: []
		});

		expect(report.state).toBe('unchecked');
	});

	it('does not call a reopened record with no stored findings "nothing on the paper"', () => {
		// The inverse of the case above, and the reason the two flags are separate. An older vault
		// record has a page and no stored `violations`; its check result is unknown, which is neither
		// clean nor an absent page.
		const report = buildQualityReport({
			hasPage: true,
			driftChecked: false,
			violations: [],
			recommendedFixes: [],
			checkResultUnrecorded: true
		});

		if (report.state !== 'flagged') throw new Error('expected a flagged report');
		expect(report.findings).toEqual([
			{
				code: CHECK_RESULT_UNRECORDED_CODE,
				message: 'No check result was stored with this page.',
				weight: 'unrecorded',
				source: 'prompt'
			}
		]);
		// Not "a check that never finished". A record with no stored findings cannot say whether the
		// check completed and went unsaved or failed, so claiming either is a second guess.
		expect(describeQualityReport(report)).toBe('One result that was never recorded.');
	});

	it('reports a page no check applies to as not-applicable, not unchecked', () => {
		// A wig try-on portrait is installed without a prompt, so no drift check is coming — which is
		// a different thing from one not having arrived yet. Rendering it as `unchecked` had System
		// Trace say "Nothing on the paper yet" about a portrait the reader was looking at.
		const report = buildQualityReport({
			hasPage: true,
			driftChecked: false,
			violations: [],
			recommendedFixes: [],
			checkApplicable: false
		});

		expect(report.state).toBe('not-applicable');
		expect(describeQualityReport(report)).toBe(
			'This page was not built from a prompt, so there is nothing to check.'
		);
	});

	it('prefers a known failure over "not recorded" when both could apply', () => {
		// The two are mutually exclusive in practice — `driftCheckFailure` comes from a fresh
		// generation and `checkResultUnrecorded` from a reopen, and the reset clears both — but if
		// they ever met, the one that says *why* wins. Reporting "no result was stored" beside a
		// reason we are holding would be throwing away the more specific truth.
		const report = buildQualityReport({
			hasPage: true,
			driftChecked: false,
			violations: [],
			recommendedFixes: [],
			checkResultUnrecorded: true,
			driftCheckFailure: { code: 'MISSING_REQUIRED_SECTION', message: 'no heading' }
		});

		if (report.state !== 'flagged') throw new Error('expected a flagged report');
		expect(report.findings.map((finding) => finding.weight)).toEqual(['blocker']);
		expect(describeQualityReport(report)).toBe(
			'1 thing wrong with the prompt and the check stopped before the rest.'
		);
	});

	it('does not report an unrecorded result for a record that has no page', () => {
		// `canSaveToVault` accepts a words-only save, so a record can be stored with no images at
		// all. Reopening one used to say its check result was never stored — about a page that was
		// never generated and had nothing for the check to inspect.
		const report = buildQualityReport({
			hasPage: false,
			driftChecked: false,
			violations: [],
			recommendedFixes: [],
			checkResultUnrecorded: true
		});

		expect(report.state).toBe('unchecked');
	});

	it('does not flag a page that simply was not produced by a checked flow', () => {
		// A wig try-on page is installed without ever calling `/api/generate`, so it has a page and no
		// drift result — the same shape as a vault record with no stored findings. Inferring the
		// unrecorded finding from that shape told a page that had never been saved that it had been
		// saved before its result was recorded, so the caller now says which case it is.
		const report = buildQualityReport({
			hasPage: true,
			driftChecked: false,
			violations: [],
			recommendedFixes: []
		});

		expect(report.state).toBe('unchecked');
	});

	it('surfaces the recommended fixes, which the old panel computed and never showed', () => {
		const report = buildQualityReport({
			hasPage: true,
			driftChecked: true,
			violations: [blocker('Missing page size line: Page size: letter.')],
			recommendedFixes: [
				{ code: 'ADD_PAGE_SIZE', message: 'Add page size line: Page size: letter.' }
			]
		});

		if (report.state !== 'flagged') throw new Error('expected a flagged report');
		expect(report.fixes).toEqual(['Add page size line: Page size: letter.']);
	});

	it('keeps fixes as their own list rather than pairing them to findings', () => {
		// Two violations, one fix. Any index- or code-based pairing would have to invent an answer
		// for the second finding or drop the fix; the report does neither, because the contract
		// promises no correspondence between the two arrays.
		const report = buildQualityReport({
			hasPage: true,
			driftChecked: true,
			violations: [blocker('first problem'), blocker('second problem')],
			recommendedFixes: [{ code: 'ADD_SOMETHING', message: 'the only fix' }]
		});

		if (report.state !== 'flagged') throw new Error('expected a flagged report');
		expect(report.findings).toHaveLength(2);
		expect(report.fixes).toEqual(['the only fix']);
		expect(report.findings.every((finding) => !('fix' in finding))).toBe(true);
	});

	it('counts a settings problem apart from a prompt one', () => {
		// Two different checks about two different things. Summing them told a reader with an invalid
		// dedication that their page had failed, when the dedication is why there is no page.
		const report = buildQualityReport({
			hasPage: true,
			driftChecked: true,
			violations: [blocker('Missing option line: Border: thin.')],
			recommendedFixes: [],
			validationIssues: [{ field: 'dedication', message: 'Dedication is too long.' }]
		});

		expect(describeQualityReport(report)).toBe(
			'1 setting to fix and 1 thing wrong with the prompt.'
		);
	});

	it('shows spec-validation issues even before a page exists', () => {
		// A failing spec check is why there is no page — the studio refuses to generate while it
		// holds any — so gating it behind "a page exists" would hide the only actionable complaint.
		const report = buildQualityReport({
			hasPage: false,
			driftChecked: false,
			violations: [],
			recommendedFixes: [],
			validationIssues: [{ field: 'dedication', message: 'Dedication is too long.' }]
		});

		if (report.state !== 'flagged') throw new Error('expected a flagged report');
		expect(report.findings).toEqual([
			{
				code: 'dedication',
				message: 'Dedication is too long.',
				weight: 'blocker',
				source: 'settings'
			}
		]);
		// Worded as the request, not the result. A spec-validation failure is usually *why* there is
		// no page, so counting it as something "the page got wrong" reported a failure of a page that
		// does not exist.
		expect(describeQualityReport(report)).toBe('1 setting to fix.');
	});

	it('ignores stale drift findings while no page is on the paper', () => {
		const report = buildQualityReport({
			hasPage: false,
			driftChecked: false,
			violations: [blocker('a finding from a page that is gone')],
			recommendedFixes: [{ code: 'ADD_SOMETHING', message: 'a fix for a page that is gone' }],
			validationIssues: [{ field: 'title', message: 'Title is required.' }]
		});

		if (report.state !== 'flagged') throw new Error('expected a flagged report');
		expect(report.findings.map((finding) => finding.message)).toEqual(['Title is required.']);
		expect(report.fixes).toEqual([]);
	});
});

describe('describeQualityReport', () => {
	it('counts blockers and notes separately in one sentence', () => {
		const report = buildQualityReport({
			hasPage: true,
			driftChecked: true,
			violations: [blocker('one'), blocker('two'), warning('three')],
			recommendedFixes: []
		});

		expect(describeQualityReport(report)).toBe('2 things wrong with the prompt and 1 worth noting.');
	});

	it('uses the singular for a single blocker', () => {
		const report = buildQualityReport({
			hasPage: true,
			driftChecked: true,
			violations: [blocker('one')],
			recommendedFixes: []
		});

		expect(describeQualityReport(report)).toBe('1 thing wrong with the prompt.');
	});

	it('joins all three kinds with commas and a trailing "and"', () => {
		const report = buildQualityReport({
			hasPage: true,
			driftChecked: true,
			violations: [blocker('one'), warning('two')],
			recommendedFixes: [],
			driftCheckFailure: { code: 'MISSING_REQUIRED_SECTION', message: 'no heading' }
		});

		expect(describeQualityReport(report)).toBe(
			// Two blockers now: the real violation, and the named missing heading that used to be
			// filed as an unknown state.
			'2 things wrong with the prompt, 1 worth noting and the check stopped before the rest.'
		);
	});
});
