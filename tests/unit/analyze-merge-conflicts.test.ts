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
	rewriteRow,
	summarizeConflictPaths
} from '../../scripts/analyze-merge-conflicts.js';
import { selectCleanCandidates } from '../../scripts/validate-pr-backlog.js';

const HEADER = '| PR | Title | Head | Merge status | Conflicting paths | Content lacks | Disposition |';
const DIVIDER = '| --- | --- | --- | --- | --- | --- | --- |';
// Named because several tests need the same ones, and a fixture repeated verbatim is a fixture
// nobody can change in one place.
const CLEAN_ROW = '| #348 | t | h | CLEAN | — | c | d |';
const CONFLICTED_LOG = 'WORST_TO_BEST_LOG.md';

describe('parseTableColumns', () => {
	it('maps header names to their index in the split parts', () => {
		const columns = parseTableColumns(HEADER);
		expect(columns[STATUS_COLUMN]).toBe(4);
		expect(columns[CONFLICT_PATHS_COLUMN]).toBe(5);
		expect(columns.disposition).toBe(7);
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
		const row = '| #338 | docs: a title | `a-branch` | CLEAN | — | a gap | **Port it.** |';
		const rewritten = rewriteRow(row, columns, {
			status: 'CONFLICT',
			conflictPaths: ['plan.md', CONFLICTED_LOG]
		});
		const cells = rewritten.split('|');
		expect(cells[4].trim()).toBe('CONFLICT');
		expect(cells[5].trim()).toBe('plan.md, WORST_TO_BEST_LOG.md');
		// The disposition is a human's decision. Losing it on a refresh is the defect these tests exist
		// for, so it is asserted rather than assumed.
		expect(cells[7].trim()).toBe('**Port it.**');
		expect(cells[6].trim()).toBe('a gap');
		expect(cells[1].trim()).toBe('#338');
	});

	it('keeps the status cell to exactly CLEAN or CONFLICT, never a decorated value', () => {
		const row = '| #348 | t | h | CONFLICT | a.md | c | d |';
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
		const row = '| #1 | t | h | CLEAN | — | c | d |';
		const cells = rewriteRow(row, columns, {
			status: 'CONFLICT',
			conflictPaths: [],
			failureNote: 'merge-tree failed without naming files: fatal: not a valid object'
		}).split('|');
		expect(cells[5].trim()).toMatch(/^merge-tree failed without naming files:/);
	});

	it('never emits a pipe inside a cell, which would split the row', () => {
		const cells = rewriteRow('| #1 | t | h | CLEAN | — | c | d |', columns, {
			status: 'CONFLICT',
			conflictPaths: [],
			failureNote: 'error: a | b'
		}).split('|');
		expect(cells).toHaveLength(9);
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
			'| #296 | t | h | CONFLICT | a.md | c | d |',
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
	it('picks the rows the status column marks CLEAN', () => {
		expect(
			selectCleanCandidates([
				HEADER,
				DIVIDER,
				CLEAN_ROW,
				'| #338 | t | h | CONFLICT | plan.md | c | d |',
				'| #296 | t | h | CLEAN | — | c | d |'
			])
		).toEqual([348, 296]);
	});

	// The defect this replaced: the selection searched every line for the literal
	// "1. Safe candidate for dry-run", so a table that stopped using the phrase reported no
	// candidates and exited 0 — indistinguishable from a drained backlog.
	it('does not depend on the retired bucket vocabulary appearing anywhere in the row', () => {
		expect(
			selectCleanCandidates([HEADER, '| #348 | t | h | CLEAN | — | c | **Superseded.** |'])
		).toEqual([348]);
	});

	it('returns nothing for a table it cannot read, rather than guessing', () => {
		expect(selectCleanCandidates(['| PR | Title | Disposition |', '| #348 | t | d |'])).toEqual([]);
	});
});

describe('the committed triage table', () => {
	const table = fs.readFileSync(path.resolve('docs/triage-table.md'), 'utf8').split('\n');

	it('has a header this script can find, so a refresh cannot rewrite the wrong cells', () => {
		const header = table.find((line) => parseTableColumns(line)[STATUS_COLUMN] !== undefined);
		expect(header).toBeDefined();
		expect(parseTableColumns(header ?? '')[CONFLICT_PATHS_COLUMN]).toBeDefined();
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
