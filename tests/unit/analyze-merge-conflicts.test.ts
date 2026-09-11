// Purpose: Cover the two scripts that read and write docs/triage-table.md — the analyzer's column
//          mapping, row rewriting and conflict summarising, and the backlog validator's selection.
// Why: Both were coupled to the table by position or by a literal phrase, and both failed silently
//      when it changed: the analyzer overwrote a human's disposition with a merge note, and the
//      validator reported an empty backlog that looked exactly like a drained one. These tests are
//      the guard, and the last two read the real table so the three cannot drift apart again.
// Info flow: header line -> column map -> rewritten row or selected candidates.
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import {
	CONFLICT_PATHS_COLUMN,
	STATUS_COLUMN,
	parseConflictPaths,
	parseTableColumns,
	readTable,
	refreshRows,
	rewriteProvenance,
	rewriteRow,
	summarizeConflictPaths
} from '../../scripts/analyze-merge-conflicts.js';
import { DRY_RUN_COLUMN, selectCleanCandidates } from '../../scripts/validate-pr-backlog.js';

const HEADER =
	'| PR | Title | Head | Merge status | Conflicting paths | Dry-run | Content lacks | Disposition |';
const DIVIDER = '| --- | --- | --- | --- | --- | --- | --- | --- |';
// Named because several tests need the same ones, and a fixture repeated verbatim is a fixture
// nobody can change in one place.
const CLEAN_ROW = '| #348 | t | h | CLEAN | — | yes | c | d |';
const CONFLICTED_LOG = 'WORST_TO_BEST_LOG.md';

describe('parseTableColumns', () => {
	it('maps header names to their index in the split parts', () => {
		const columns = parseTableColumns(HEADER);
		expect(columns[STATUS_COLUMN]).toBe(4);
		expect(columns[CONFLICT_PATHS_COLUMN]).toBe(5);
		expect(columns[DRY_RUN_COLUMN]).toBe(6);
		expect(columns.disposition).toBe(8);
	});

	it('ignores backticks and case, so a header may be written as prose or code', () => {
		expect(parseTableColumns('| `Merge Status` |')[STATUS_COLUMN]).toBe(1);
	});

	it('reports no status column for a row that is not a header', () => {
		expect(parseTableColumns('| #348 | a title | a head | CLEAN |')[STATUS_COLUMN]).toBeUndefined();
	});
});

describe('rewriteRow', () => {
	const columns = parseTableColumns(HEADER);

	it('writes only the two measured columns and leaves the rest byte-identical', () => {
		const row = '| #338 | docs: a title | `a-branch` | CLEAN | — | no | a gap | **Port it.** |';
		const rewritten = rewriteRow(row, columns, {
			status: 'CONFLICT',
			conflictPaths: ['plan.md', CONFLICTED_LOG]
		});
		const cells = rewritten.split('|');
		expect(cells[4].trim()).toBe('CONFLICT');
		expect(cells[5].trim()).toBe('plan.md, WORST_TO_BEST_LOG.md');
		// The disposition is a human's decision. Losing it on a refresh is the defect these tests exist
		// for, so it is asserted rather than assumed.
		expect(cells[8].trim()).toBe('**Port it.**');
		expect(cells[7].trim()).toBe('a gap');
		// The human's dry-run answer is not the script's either.
		expect(cells[6].trim()).toBe('no');
		expect(cells[1].trim()).toBe('#338');
	});

	it('keeps the status cell to exactly CLEAN or CONFLICT, never a decorated value', () => {
		const row = '| #348 | t | h | CONFLICT | a.md | no | c | d |';
		const cells = rewriteRow(row, columns, { status: 'CLEAN', conflictPaths: [] }).split('|');
		expect(cells[4].trim()).toBe('CLEAN');
		expect(cells[5].trim()).toBe('—');
	});

	it('drops the paths rather than smuggling them into the status when the column is absent', () => {
		const narrow = parseTableColumns('| PR | Title | Merge status |');
		const rewritten = rewriteRow('| #348 | t | CLEAN |', narrow, {
			status: 'CONFLICT',
			conflictPaths: ['a.md']
		});
		expect(rewritten.split('|')[3].trim()).toBe('CONFLICT');
		expect(rewritten).not.toContain('a.md');
	});

	it('records a non-conflict merge failure instead of naming files it does not have', () => {
		const row = '| #1 | t | h | CLEAN | — | no | c | d |';
		const cells = rewriteRow(row, columns, {
			status: 'CONFLICT',
			conflictPaths: [],
			failureNote: 'merge-tree did not run: not something we can merge'
		}).split('|');
		expect(cells[5].trim()).toBe('merge-tree did not run: not something we can merge');
		// The note replaces the path list rather than joining it, so no error text can be mistaken
		// for a filename in the column a reader scans for filenames.
		expect(cells[5]).not.toContain('—');
	});

	it('never emits a pipe inside a cell, which would split the row', () => {
		const cells = rewriteRow('| #1 | t | h | CLEAN | — | no | c | d |', columns, {
			status: 'CONFLICT',
			conflictPaths: [],
			failureNote: 'error: a | b'
		}).split('|');
		expect(cells).toHaveLength(10);
		expect(cells[5]).toContain('a / b');
	});
});

describe('parseConflictPaths', () => {
	it('takes the filenames between the tree id and git’s own messages', () => {
		const output = [
			'96ac2bceb72a3f78cf42a038105be718a066297d',
			CONFLICTED_LOG,
			'plan.md',
			'',
			'Auto-merging WORST_TO_BEST_LOG.md',
			'CONFLICT (content): Merge conflict in WORST_TO_BEST_LOG.md'
		].join('\n');
		expect(parseConflictPaths(output)).toEqual([CONFLICTED_LOG, 'plan.md']);
	});

	it('returns nothing for a clean merge, whose output is the tree id alone', () => {
		expect(parseConflictPaths('d2c0f80fd6a2e9f062fa9a16982605b3b9ef66df')).toEqual([]);
	});

	// The defect: `runCommand` used to expose only stdout and stderr combined, so an operational
	// failure — an invalid ref, an unknown option — produced an empty first line where the tree id
	// belonged. This function dropped that line and read git's error message as a filename, and the
	// table recorded CONFLICT with an error string under conflicting paths. Reproduced on git 2.43.
	it('refuses output whose first line is not a tree id, rather than reading an error as a filename', () => {
		const combined =
			'\nmerge-tree: refs/does-not-exist - not something we can merge\n\nCommand failed: git merge-tree';
		expect(parseConflictPaths(combined)).toBeNull();
	});

	it('refuses a stderr message on its own', () => {
		expect(parseConflictPaths('merge-tree: refs/nope - not something we can merge')).toBeNull();
	});

	it('refuses empty stdout, which is what a command that never ran leaves behind', () => {
		expect(parseConflictPaths('')).toBeNull();
	});

	it('distinguishes null from an empty list, because they mean opposite things', () => {
		// [] is "a conflicted merge that named no files"; null is "this was not a merge-tree result".
		expect(parseConflictPaths('d2c0f80fd6a2e9f062fa9a16982605b3b9ef66df')).not.toBeNull();
	});
});

describe('summarizeConflictPaths', () => {
	it('collapses a directory that contributes more than one file', () => {
		expect(
			summarizeConflictPaths([
				'DECISIONS.md',
				'docs/evidence/2026-09-05/test.txt',
				'docs/evidence/2026-09-05/verify.txt',
				'docs/evidence/2026-09-05/lint.txt'
			])
		).toBe('DECISIONS.md, docs/evidence/2026-09-05/* (3 files)');
	});

	it('keeps a lone file in a directory by name, because one file is different news', () => {
		expect(summarizeConflictPaths(['docs/seams.md', 'plan.md'])).toBe('plan.md, docs/seams.md');
	});

	it('says so when there is nothing to name', () => {
		expect(summarizeConflictPaths([])).toBe('—');
	});
});

describe('readTable', () => {
	it('finds the header, its columns and every PR row beneath it', () => {
		const table = readTable([
			'# Live PR Triage Table',
			'',
			HEADER,
			DIVIDER,
			CLEAN_ROW,
			'| #296 | t | h | CONFLICT | a.md | no | c | d |',
			'',
			'## Prose that mentions #175 but is not a row'
		]);
		expect(table?.headerIndex).toBe(2);
		expect(table?.columns[STATUS_COLUMN]).toBe(4);
		expect(table?.prRows).toEqual([
			{ pr: 348, lineIndex: 4 },
			{ pr: 296, lineIndex: 5 }
		]);
	});

	it('refuses the table rather than guessing when no status column exists', () => {
		expect(readTable(['| PR | Title | Disposition |', '| #348 | t | d |'])).toBeNull();
	});

	it('ignores PR-looking rows above the header', () => {
		const table = readTable(['| #99 | a row in an example block |', HEADER, CLEAN_ROW]);
		expect(table?.prRows).toEqual([{ pr: 348, lineIndex: 2 }]);
	});
});

describe('selectCleanCandidates', () => {
	it('needs both a CLEAN status and a dry-run yes', () => {
		expect(
			selectCleanCandidates([
				HEADER,
				DIVIDER,
				CLEAN_ROW,
				'| #338 | t | h | CONFLICT | plan.md | yes | c | d |',
				'| #296 | t | h | CLEAN | — | yes | c | d |'
			]).candidates
		).toEqual([348, 296]);
	});

	// The defect: a PR can merge cleanly and still be one the table says not to merge. #348 was
	// exactly that — CLEAN, and superseded by the branch that measured it. Selecting on the status
	// alone would have checked it out and reported "Ready to merge."
	it('leaves a CLEAN row alone when the dry-run column says no', () => {
		expect(
			selectCleanCandidates([
				HEADER,
				'| #348 | t | h | CLEAN | — | no | c | **Superseded.** |'
			]).candidates
		).toEqual([]);
	});

	it('reads the answer case-insensitively, since a human types it', () => {
		expect(
			selectCleanCandidates([HEADER, '| #348 | t | h | Clean | — | YES | c | d |']).candidates
		).toEqual([348]);
	});

	// The previous defect, kept as a test: the selection searched every line for the literal
	// "1. Safe candidate for dry-run", so a table that stopped using the phrase reported no
	// candidates and exited 0 — indistinguishable from a drained backlog.
	it('does not depend on the retired bucket vocabulary appearing anywhere in the row', () => {
		expect(selectCleanCandidates([HEADER, CLEAN_ROW]).candidates).toEqual([348]);
	});

	it('gives a reason rather than an empty backlog when it cannot read the table', () => {
		const unreadable = selectCleanCandidates(['| PR | Title | Disposition |', '| #348 | t | d |']);
		expect(unreadable.candidates).toEqual([]);
		expect(unreadable.reason).toContain(STATUS_COLUMN);
	});

	// Falling back to the status alone here is what the finding above is about, so a table missing
	// the column selects nothing and says why — the caller exits non-zero on a reason.
	it('gives a reason rather than falling back when the dry-run column is missing', () => {
		const noColumn = selectCleanCandidates([
			'| PR | Title | Head | Merge status | Conflicting paths | Disposition |',
			'| #348 | t | h | CLEAN | — | d |'
		]);
		expect(noColumn.candidates).toEqual([]);
		expect(noColumn.reason).toContain(DRY_RUN_COLUMN);
	});
});

describe('rewriteProvenance', () => {
	it('rewrites the refresh line with the date and base actually measured', () => {
		const lines = ['# Title', '', 'Last refreshed: **2026-01-01**, against `origin/main` at `old`.'];
		expect(rewriteProvenance(lines, { date: '2026-09-11', base: 'f1a8c91' })).toBe(true);
		expect(lines[2]).toBe('Last refreshed: **2026-09-11**, against `origin/main` at `f1a8c91`.');
	});

	// The finding: the script rewrote the measured cells and left this line saying an older base, so
	// a refresh after main advanced produced a table whose provenance contradicted its own contents.
	it('rewrites the line it produced, so a second refresh is idempotent in shape', () => {
		const lines = ['Last refreshed: **2026-09-11**, against `origin/main` at `f1a8c91`.'];
		rewriteProvenance(lines, { date: '2026-09-12', base: 'abc1234' });
		expect(lines[0]).toBe('Last refreshed: **2026-09-12**, against `origin/main` at `abc1234`.');
	});

	it('reports that there was no line to rewrite rather than inventing one', () => {
		const lines = ['# Title', ''];
		expect(rewriteProvenance(lines, { date: '2026-09-11', base: 'f1a8c91' })).toBe(false);
		expect(lines).toEqual(['# Title', '']);
	});
});

describe('refreshRows', () => {
	const lines = [HEADER, DIVIDER, CLEAN_ROW, '| #296 | t | h | CLEAN | — | yes | c | d |'];
	const table = readTable(lines);
	const prRows = table?.prRows ?? [];
	const columns = table?.columns ?? {};

	it('rewrites every row when every row could be measured', () => {
		const refreshed = refreshRows(lines, columns, prRows, () => ({
			status: 'CONFLICT',
			conflictPaths: ['plan.md']
		}));
		expect(refreshed.skipped).toEqual([]);
		expect(refreshed.lines?.[2].split('|')[4].trim()).toBe('CONFLICT');
		expect(refreshed.lines?.[3].split('|')[4].trim()).toBe('CONFLICT');
		expect(refreshed.measured.map((row) => row.pr)).toEqual([348, 296]);
	});

	// The defect: one unfetchable row was skipped, the rest were written, and the provenance line was
	// rewritten anyway — so the table claimed one date and base for a mixture of old and new
	// measurements, and exited 0. All-or-nothing is what makes that line's claim true.
	it('writes nothing at all when any row could not be measured', () => {
		const refreshed = refreshRows(lines, columns, prRows, (pr) =>
			pr === 296 ? null : { status: 'CONFLICT', conflictPaths: ['plan.md'] }
		);
		expect(refreshed.lines).toBeNull();
		expect(refreshed.skipped).toEqual([296]);
	});

	it('names every row it could not measure, not just the first', () => {
		const refreshed = refreshRows(lines, columns, prRows, () => null);
		expect(refreshed.skipped).toEqual([348, 296]);
		expect(refreshed.lines).toBeNull();
	});

	it('leaves the caller\u2019s array untouched, so an aborted refresh cannot half-apply', () => {
		const original = [...lines];
		refreshRows(lines, columns, prRows, (pr) =>
			pr === 296 ? null : { status: 'CONFLICT', conflictPaths: ['plan.md'] }
		);
		expect(lines).toEqual(original);
	});
});

describe('the committed triage table', () => {
	const table = fs.readFileSync(path.resolve('docs/triage-table.md'), 'utf8').split('\n');

	it('has a header this script can find, so a refresh cannot rewrite the wrong cells', () => {
		const header = table.find((line) => parseTableColumns(line)[STATUS_COLUMN] !== undefined);
		expect(header).toBeDefined();
		expect(parseTableColumns(header ?? '')[CONFLICT_PATHS_COLUMN]).toBeDefined();
	});

	it('carries a provenance line the analyzer can rewrite', () => {
		const provenance = table.filter((line) => line.startsWith('Last refreshed:'));
		expect(provenance).toHaveLength(1);
		expect(provenance[0]).toMatch(
			/^Last refreshed: \*\*\d{4}-\d{2}-\d{2}\*\*, against `origin\/main` at `[0-9a-f]{7,40}`\.$/
		);
	});

	it('answers the dry-run column with yes or no in every PR row', () => {
		const header = table.find((line) => parseTableColumns(line)[STATUS_COLUMN] !== undefined) ?? '';
		const dryRunIndex = parseTableColumns(header)[DRY_RUN_COLUMN];
		expect(dryRunIndex).toBeDefined();
		for (const row of table.filter((line) => /^\|\s*#\d+\s*\|/.test(line))) {
			expect(row.split('|')[dryRunIndex].trim()).toMatch(/^(yes|no)$/i);
		}
	});

	it('holds exactly CLEAN or CONFLICT in the status cell of every PR row', () => {
		const header = table.find((line) => parseTableColumns(line)[STATUS_COLUMN] !== undefined) ?? '';
		const statusIndex = parseTableColumns(header)[STATUS_COLUMN];
		const prRows = table.filter((line) => /^\|\s*#\d+\s*\|/.test(line));
		expect(prRows.length).toBeGreaterThan(0);
		for (const row of prRows) {
			expect(row.split('|')[statusIndex].trim()).toMatch(/^(CLEAN|CONFLICT)$/);
		}
	});
});
