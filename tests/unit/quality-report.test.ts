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
		expect(describeQualityReport(report)).toBe('The page came back exactly as asked.');
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
		expect(report.findings.map((finding) => finding.weight)).toEqual([
			'blocker',
			'check-failed',
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

	it('treats a failed check as neither a blocker nor a note', () => {
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
		// An incomplete check says nothing about the page in either direction, so it must not be
		// counted among the things the page got wrong.
		expect(report.findings[0].weight).toBe('check-failed');
		expect(report.findings[0].message).toContain('Required section missing: STYLE:');
		expect(report.hasIncompleteCheck).toBe(true);
		expect(describeQualityReport(report)).toBe('One check that never finished.');
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
			recommendedFixes: []
		});

		if (report.state !== 'flagged') throw new Error('expected a flagged report');
		expect(report.findings).toEqual([
			{
				code: CHECK_RESULT_UNRECORDED_CODE,
				message:
					'This page was saved before its check result was recorded, so it is not on file.',
				weight: 'check-failed'
			}
		]);
		expect(report.hasIncompleteCheck).toBe(true);
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
			{ code: 'dedication', message: 'Dedication is too long.', weight: 'blocker' }
		]);
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

		expect(describeQualityReport(report)).toBe('2 things the page got wrong and 1 worth noting.');
	});

	it('uses the singular for a single blocker', () => {
		const report = buildQualityReport({
			hasPage: true,
			driftChecked: true,
			violations: [blocker('one')],
			recommendedFixes: []
		});

		expect(describeQualityReport(report)).toBe('1 thing the page got wrong.');
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
			'1 thing the page got wrong, 1 worth noting and one check that never finished.'
		);
	});
});
