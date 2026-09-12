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
	CONFLICT_BLOCK_BEGIN,
	CONFLICT_BLOCK_END,
	CONFLICT_PATHS_COLUMN,
	fenceFor,
	fencedLines,
	tableRowEnd,
	findConflictBlock,
	findDuplicateColumns,
	validateTable,
	findRowsWithBadPrCell,
	isDividerRow,
	escapeCell,
	findMalformedRows,
	PR_COLUMN,
	STATUS_COLUMN,
	parseConflictPaths,
	parseTableColumns,
	readTable,
	refreshRows,
	renderConflictDetails,
	rewriteConflictBlock,
	rewriteProvenance,
	rewriteRow,
	splitRow,
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
const TWO_CONFLICTS = `plan.md, ${CONFLICTED_LOG}`;
// A row whose PR cell is the header's width but does not name a PR — the hole that tightening the row
// match to `#<digits>` opened, and which both readers now refuse.
const ROW_WITHOUT_HASH = '| 348 | t | h | CLEAN | — | yes | c | d |';
const EVIDENCE_PATH = 'docs/evidence/2026-09-05/test.txt';
const UNFETCHABLE = 'could not fetch its head';

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

describe('splitRow', () => {
	it('splits on plain pipes', () => {
		expect(splitRow('| a | b |')).toEqual(['', ' a ', ' b ', '']);
	});

	// The defect: a PR title may contain an escaped pipe, and split('|') treated it as a separator —
	// shifting every cell after it. The selection then read the Head cell as the merge status and
	// found no candidates, and rewriteRow wrote CONFLICT into the Head column.
	// The defect: escaping was decided by a lookbehind for one backslash. A cell ending in a literal
	// backslash puts an EVEN run before the delimiter — `| a\\\\| b |` is "a\\" then a real delimiter —
	// and the lookbehind suppressed it, merging two cells. Parity of the run is the rule.
	it('treats a pipe after an even backslash run as a delimiter', () => {
		expect(splitRow('| a \\\\| b |')).toHaveLength(4);
	});

	it('treats a pipe after an odd backslash run as escaped', () => {
		expect(splitRow('| a \\| b |')).toHaveLength(3);
		expect(splitRow('| a \\\\\\| b |')).toHaveLength(3);
	});

	it('round-trips every escaping shape through join', () => {
		for (const line of [
			'| a | b |',
			'| a \\| b |',
			'| a \\\\| b |',
			'| a \\\\\\| b |',
			`| ${TWO_CONFLICTS} |`
		]) {
			expect(splitRow(line).join('|')).toBe(line);
		}
	});

	it('keeps an escaped pipe inside its cell', () => {
		expect(splitRow('| #400 | fix parser \\| safely | CLEAN |')).toEqual([
			'',
			' #400 ',
			' fix parser \\| safely ',
			' CLEAN ',
			''
		]);
	});

	it('round-trips, which is what lets rewriteRow leave other cells byte-identical', () => {
		const row = '| #400 | fix parser \\| safely | `h` | CLEAN | — | yes | c | d |';
		expect(splitRow(row).join('|')).toBe(row);
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
		expect(cells[5].trim()).toBe(TWO_CONFLICTS);
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

	// A pipe in a note or a filename must not split the row. This used to assert the pipe was replaced
	// with a slash, which does not split the row but renames the file — so the assertion is now that it
	// is escaped and read back intact, which satisfies both.
	it('escapes a pipe in a note rather than splitting the row or rewriting the text', () => {
		const written = rewriteRow('| #1 | t | h | CLEAN | — | no | c | d |', columns, {
			status: 'CONFLICT',
			conflictPaths: [],
			failureNote: 'error: a | b'
		});
		const cells = splitRow(written);
		expect(cells).toHaveLength(10);
		expect(cells[5].trim()).toBe('error: a \\| b');
	});
});

describe('escapeCell', () => {
	// The defect: a conflicted filename may legitimately contain a pipe, and this used to replace it
	// with `/` — recording a/b.md for a|b.md, a different file, in the column a reader trusts to name
	// files. splitRow already reads the escape, so the name survives and the row still parses.
	it('escapes a pipe rather than changing the filename', () => {
		expect(escapeCell('a|b.md')).toBe('a\\|b.md');
	});

	it('round-trips through splitRow as one cell', () => {
		const row = `| #1 | t | ${escapeCell('a|b.md')} | d |`;
		expect(splitRow(row)[3].trim()).toBe('a\\|b.md');
		expect(splitRow(row)).toHaveLength(6);
	});

	it('escapes backslashes first, so the escape cannot be undone by one already there', () => {
		expect(escapeCell('a\\|b.md')).toBe('a\\\\\\|b.md');
	});

	it('leaves text with nothing to escape alone', () => {
		expect(escapeCell(TWO_CONFLICTS)).toBe(TWO_CONFLICTS);
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

	// A filename may legitimately begin or end with a space and git emits it verbatim; trimming recorded
	// ` leadtrail ` as `leadtrail`, a different file, in the column a reader trusts to name files.
	it('keeps whitespace that belongs to the filename', () => {
		expect(
			parseConflictPaths('d2c0f80fd6a2e9f062fa9a16982605b3b9ef66df\n leadtrail \n')
		).toEqual([' leadtrail ']);
	});

	it('still strips a trailing carriage return, which belongs to the line not the name', () => {
		expect(
			parseConflictPaths('d2c0f80fd6a2e9f062fa9a16982605b3b9ef66df\nplan.md\r\n')
		).toEqual(['plan.md']);
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

describe('parseConflictPaths and a filename with nothing but spaces in it', () => {
	const TREE = 'a'.repeat(40);

	// The terminator is an empty line, not a blank one. Tested on a trimmed copy, a file literally named
	// `   ` read as the separator before git's diagnostics: the table recorded that git named no files and
	// the real path was missing from the complete block too. Same mistake as trimming the path itself, one
	// line lower — whitespace inside a filename is content, and only a line with nothing in it is structure.
	it('keeps a path made entirely of spaces', () => {
		expect(parseConflictPaths(`${TREE}\n   \nplan.md\n\nAuto-merging plan.md`)).toEqual([
			'   ',
			'plan.md'
		]);
	});

	it('still stops at the truly empty line before git\u2019s own messages', () => {
		expect(parseConflictPaths(`${TREE}\nplan.md\n\nCONFLICT (content): plan.md`)).toEqual([
			'plan.md'
		]);
	});
});

describe('summarizeConflictPaths', () => {
	it('collapses a directory that contributes more than one file', () => {
		expect(
			summarizeConflictPaths([
				'DECISIONS.md',
				EVIDENCE_PATH,
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
			ok: true,
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
			pr === 296
				? { ok: false, reason: UNFETCHABLE }
				: { ok: true, status: 'CONFLICT', conflictPaths: ['plan.md'] }
		);
		expect(refreshed.lines).toBeNull();
		expect(refreshed.skipped).toEqual([{ pr: 296, reason: UNFETCHABLE }]);
	});

	// `measureAgainstMain` itself is not unit-tested: every path in it runs `git fetch` against the
	// remote, and a unit suite that reaches the network fails on an egress-restricted runner and
	// depends on a PR ref outliving this test. The injected `measure` here is the seam that exists so
	// its two outcomes can be driven without it.
	//
	// Each skip keeps its own reason: two rows can fail for different causes, and "could not measure
	// #348, #296" without saying why sends the next reader back to run the commands by hand.
	it('keeps a reason per skipped row, not one for the batch', () => {
		const refreshed = refreshRows(lines, columns, prRows, (pr) => ({
			ok: false,
			reason: pr === 348 ? UNFETCHABLE : 'merge-tree did not run'
		}));
		expect(refreshed.skipped).toEqual([
			{ pr: 348, reason: UNFETCHABLE },
			{ pr: 296, reason: 'merge-tree did not run' }
		]);
		expect(refreshed.lines).toBeNull();
	});

	it('leaves the caller\u2019s array untouched, so an aborted refresh cannot half-apply', () => {
		const original = [...lines];
		refreshRows(lines, columns, prRows, (pr) =>
			pr === 296
				? { ok: false, reason: UNFETCHABLE }
				: { ok: true, status: 'CONFLICT', conflictPaths: ['plan.md'] }
		);
		expect(lines).toEqual(original);
	});
});

describe('findDuplicateColumns', () => {
	// parseTableColumns keeps the first index for a repeated name, which is a silent choice: a table
	// with two `Merge status` columns has the first refreshed and the second left stale, under one
	// provenance line claiming both were measured. Row width cannot reveal it — the width is right.
	it('names a duplicated column this script writes', () => {
		expect(
			findDuplicateColumns('| PR | Title | Merge status | Merge status | Conflicting paths | d |')
		).toEqual([STATUS_COLUMN]);
	});

	it('ignores a duplicated column this script does not write', () => {
		expect(findDuplicateColumns(`| PR | Title | Title | ${'Merge status'} | Conflicting paths |`)).toEqual(
			[]
		);
	});

	it('accepts the committed header', () => {
		expect(findDuplicateColumns(HEADER)).toEqual([]);
	});

	// The columns each tool reads differ, and this was hard-wired to the analyzer's three — so the
	// validator had no way to reject a duplicated `Dry-run`, and a header carrying it twice let one row
	// answer yes and no at once with the earlier copy silently winning.
	it('names a duplicate among the columns a caller asks about', () => {
		expect(
			findDuplicateColumns('| PR | Merge status | Dry-run | Dry-run |', [
				PR_COLUMN,
				STATUS_COLUMN,
				DRY_RUN_COLUMN
			])
		).toEqual([DRY_RUN_COLUMN]);
	});

	it('leaves that column out by default, because the analyzer does not read it', () => {
		expect(findDuplicateColumns('| PR | Merge status | Dry-run | Dry-run |')).toEqual([]);
	});
});

describe('readTable finding rows by the PR column', () => {
	// A row used to be recognised by a regex anchored to the first cell, while every other column came
	// from the header. Reorder the table and it found no rows at all — so the analyzer exited 0 saying
	// "No PR rows found" and the validator reported an empty backlog, both silently off.
	it('finds rows when the PR column is not first', () => {
		const reordered = [
			'| Merge status | PR | Title | Head | Conflicting paths | Dry-run | Content | Disposition |',
			'| CLEAN | #348 | t | h | — | yes | c | d |'
		];
		expect(readTable(reordered)?.prRows).toEqual([{ pr: 348, lineIndex: 1 }]);
	});

	it('finds no rows when there is no PR column, rather than guessing the first cell', () => {
		const noPr = ['| Ticket | Title | Merge status | Conflicting paths |', '| #348 | t | CLEAN | — |'];
		expect(readTable(noPr)?.prRows).toEqual([]);
	});

	it('ignores a cell that is not exactly a PR reference', () => {
		expect(readTable([HEADER, '| see #348 | t | h | CLEAN | — | no | c | d |'])?.prRows).toEqual([]);
	});
});

describe('findRowsWithBadPrCell', () => {
	const DIV = '| --- | --- | --- | --- | --- | --- | --- | --- |';
	const bad = (lines: string[]) =>
		findRowsWithBadPrCell(lines, 0, parseTableColumns(lines[0]));

	// Tightening the row match to `#<digits>` closed one hole and opened a quieter one: `348` without
	// the `#` in a real data row simply vanishes from prRows, where findMalformedRows cannot see it —
	// so the analyzer refreshes every other row, advances provenance, and never measures that PR.
	it('names a full-width row whose PR cell does not name a PR', () => {
		expect(bad([HEADER, DIV, ROW_WITHOUT_HASH])).toEqual([
			{ lineIndex: 2, cell: '348' }
		]);
	});

	it('accepts a full-width row whose PR cell does name one', () => {
		expect(bad([HEADER, DIV, CLEAN_ROW])).toEqual([]);
	});

	// Width is what separates a data row from prose, so both of the previous behaviours stay correct:
	// a narrow line mentioning a PR is still ignored rather than treated as a row.
	it('ignores prose and narrow lines, however they mention a PR', () => {
		expect(bad([HEADER, 'some prose about #348', '| a | b |', ''])).toEqual([]);
	});

	it('ignores the header\u2019s divider, which is full width by definition', () => {
		expect(bad([HEADER, DIV])).toEqual([]);
	});
});

describe('isDividerRow', () => {
	it('recognises a divider, with or without alignment colons', () => {
		expect(isDividerRow('| --- | --- |')).toBe(true);
		expect(isDividerRow('| :--- | ---: | :-: |')).toBe(true);
	});

	it('does not mistake a data row for one', () => {
		expect(isDividerRow(CLEAN_ROW)).toBe(false);
	});
});

describe('findMalformedRows', () => {
	const malformed = (lines: string[]) => {
		const table = readTable(lines);
		return findMalformedRows(lines, table?.headerIndex ?? 0, table?.prRows ?? []);
	};

	// rewriteRow guards against an out-of-range index and so does nothing for a short row, quietly —
	// while refreshRows counted it as measured. The table would be written, its provenance rewritten,
	// and the run would exit 0 with that row unmeasured.
	it('names a row truncated at the end', () => {
		expect(malformed([HEADER, CLEAN_ROW, '| #317 | title |'])).toEqual([
			{ pr: 317, cells: 4, expected: 10 }
		]);
	});

	// The reason this checks width equality rather than "are the owned columns in range": delete an
	// interior cell and the row still has cells at those indexes, so a range check passes — but they
	// are the wrong cells, and rewriteRow writes the status into the old paths column and the paths
	// over a human's Dry-run answer.
	it('names a row with an interior cell deleted, which a range check would accept', () => {
		expect(malformed([HEADER, '| #2 | t | CLEAN | — | no | c | d |'])).toEqual([
			{ pr: 2, cells: 9, expected: 10 }
		]);
	});

	it('accepts a row of exactly the header\u2019s width', () => {
		expect(malformed([HEADER, CLEAN_ROW])).toEqual([]);
	});

	it('counts an escaped pipe as one cell, not two', () => {
		expect(malformed([HEADER, '| #400 | a \\| b | h | CLEAN | — | yes | c | d |'])).toEqual([]);
	});
});

describe('an escaped pipe in a title', () => {
	const ESCAPED = '| #400 | fix parser \\| safely | `h` | CLEAN | — | yes | c | d |';

	it('does not stop the row being selected for a dry run', () => {
		expect(selectCleanCandidates([HEADER, ESCAPED]).candidates).toEqual([400]);
	});

	it('does not let rewriteRow write the status into the wrong column', () => {
		const columns = parseTableColumns(HEADER);
		const cells = splitRow(
			rewriteRow(ESCAPED, columns, { status: 'CONFLICT', conflictPaths: ['x.md'] })
		);
		expect(cells[3].trim()).toBe('`h`');
		expect(cells[4].trim()).toBe('CONFLICT');
		expect(cells[5].trim()).toBe('x.md');
		expect(cells[2].trim()).toBe('fix parser \\| safely');
	});
});

describe('selectCleanCandidates on a malformed table', () => {
	// The rule this PR wrote down and then failed to apply to its own second reader: a rule a parser
	// gains belongs to every reader of the format. The analyzer rejected this row; the validator read
	// shifted cells, found nothing, returned no reason, and main exited 0 as if the backlog were empty.
	it('gives a reason for a row that is not the header\u2019s width', () => {
		const result = selectCleanCandidates([
			HEADER,
			'| #348 | title | CLEAN | — | yes | content | disposition |'
		]);
		expect(result.candidates).toEqual([]);
		expect(result.reason).toContain('#348');
		expect(result.reason).toContain('9 cells');
	});

	it('still selects a well-formed row beside none', () => {
		expect(selectCleanCandidates([HEADER, CLEAN_ROW]).candidates).toEqual([348]);
	});

	// The analyzer owns the status column and writes exactly CLEAN or CONFLICT. A corrupted value merely
	// excluded the row from the filter, with no reason — so a malformed table read as an empty backlog.
	it('gives a reason for a status the analyzer could not have written', () => {
		const result = selectCleanCandidates([
			HEADER,
			'| #348 | t | h | CLEEN | — | yes | c | d |'
		]);
		expect(result.candidates).toEqual([]);
		expect(result.reason).toContain('cleen');
	});

	it('gives a reason for a blank status, which is the same malformed table', () => {
		expect(
			selectCleanCandidates([HEADER, '| #348 | t | h |  | — | yes | c | d |']).reason
		).toContain(STATUS_COLUMN);
	});

	it('accepts CONFLICT as measured, selecting nothing without a reason', () => {
		const result = selectCleanCandidates([
			HEADER,
			'| #348 | t | h | CONFLICT | x.md | no | c | d |'
		]);
		expect(result.candidates).toEqual([]);
		expect(result.reason).toBeUndefined();
	});

	// A mistyped answer is not an answer. `yse` compared unequal to 'yes' and so read as a deliberate
	// `no`; if it were the only candidate the tool reported an empty backlog and exited 0 — the same
	// silence this file was fixed for twice already, by other routes.
	it('gives a reason for a dry-run cell that is neither yes nor no', () => {
		const result = selectCleanCandidates([
			HEADER,
			'| #348 | t | h | CLEAN | — | yse | c | d |'
		]);
		expect(result.candidates).toEqual([]);
		expect(result.reason).toContain('yse');
		expect(result.reason).toContain('#348');
	});

	it('accepts no as an answer, which selects nothing without a reason', () => {
		const result = selectCleanCandidates([HEADER, '| #348 | t | h | CLEAN | — | no | c | d |']);
		expect(result.candidates).toEqual([]);
		expect(result.reason).toBeUndefined();
	});

	// The same hole the analyzer was fixed for, in the second reader. A full-width data row written `348`
	// instead of `#348` does not parse as a PR, so it never reaches prRows — where findMalformedRows
	// cannot see it either. The row vanished, the selection was short by one, and nothing said so.
	it('gives a reason for a full-width row whose PR cell does not name a PR', () => {
		const result = selectCleanCandidates([
			HEADER,
			DIVIDER,
			ROW_WITHOUT_HASH
		]);
		expect(result.candidates).toEqual([]);
		expect(result.reason).toBeDefined();
		expect(result.reason).toContain('"348"');
	});

	it('reads the divider row as a divider, not as a row missing its PR', () => {
		expect(selectCleanCandidates([HEADER, DIVIDER, CLEAN_ROW]).candidates).toEqual([348]);
	});

	// Without a PR column no row is recognised at all, so the filter finds nothing and says nothing —
	// which reads as a drained backlog for a table that simply spells its first column differently.
	it('gives a reason when there is no PR column to identify rows by', () => {
		const result = selectCleanCandidates([
			'| Number | Title | Head | Merge status | Conflicting paths | Dry-run | c | d |',
			'| #348 | t | h | CLEAN | — | yes | c | d |'
		]);
		expect(result.candidates).toEqual([]);
		expect(result.reason).toBeDefined();
		expect(result.reason).toContain(PR_COLUMN);
	});

	// parseTableColumns keeps the first index for a repeated name. A header carrying `Dry-run` twice lets
	// one row answer yes and no at once, and the earlier column wins silently — on the one column that
	// decides whether this tool reports a PR ready to merge.
	it('gives a reason for a duplicated Dry-run column rather than reading the first copy', () => {
		const result = selectCleanCandidates([
			'| PR | Title | Head | Merge status | Conflicting paths | Dry-run | Dry-run | Disposition |',
			'| #348 | t | h | CLEAN | — | yes | no | d |'
		]);
		expect(result.candidates).toEqual([]);
		expect(result.reason).toBeDefined();
		expect(result.reason).toContain(DRY_RUN_COLUMN);
	});

	it('gives a reason for a duplicated Merge status column too', () => {
		const result = selectCleanCandidates([
			'| PR | Title | Merge status | Merge status | Conflicting paths | Dry-run | c | d |',
			'| #348 | t | CLEAN | CONFLICT | — | yes | c | d |'
		]);
		expect(result.candidates).toEqual([]);
		expect(result.reason).toBeDefined();
		expect(result.reason).toContain(STATUS_COLUMN);
	});
});

describe('validateTable', () => {
	// Lifted out of main so a refusal is a value rather than a process.exit, which is what lets these
	// assert the message instead of running the script as a subprocess and reading its stderr. Every one
	// of them fires before a single PR is fetched: a table this script cannot write is not worth
	// measuring against.
	const BLOCK = [CONFLICT_BLOCK_BEGIN, CONFLICT_BLOCK_END];
	const PROVENANCE = 'Last refreshed: **2026-09-12**, against `origin/main` at `f1a8c91`.';
	const wellFormed = [PROVENANCE, HEADER, DIVIDER, CLEAN_ROW, ...BLOCK];
	const reasonFor = (lines: string[]) => {
		const table = readTable(lines);
		expect(table).not.toBeNull();
		const result = validateTable(lines, table ?? { headerIndex: 0, columns: {}, prRows: [] });
		return result.ok ? '' : result.message;
	};

	it('accepts a well-formed table', () => {
		expect(reasonFor(wellFormed)).toBe('');
	});

	it('accepts the committed table, so a refresh is never blocked by the file itself', () => {
		const committed = fs.readFileSync(path.resolve('docs/triage-table.md'), 'utf8').split('\n');
		expect(reasonFor(committed)).toBe('');
	});

	it('refuses a duplicated column it writes', () => {
		const header = '| PR | Merge status | Merge status | Conflicting paths |';
		expect(reasonFor([PROVENANCE, header, '| #348 | CLEAN | CLEAN | — |', ...BLOCK])).toContain(
			'more than once'
		);
	});

	it('refuses a header with no PR column', () => {
		const header = '| Number | Merge status | Conflicting paths |';
		expect(reasonFor([PROVENANCE, header, '| #348 | CLEAN | — |', ...BLOCK])).toContain(PR_COLUMN);
	});

	it('refuses a header with no conflicting-paths column', () => {
		const header = '| PR | Merge status |';
		expect(reasonFor([PROVENANCE, header, '| #348 | CLEAN |', ...BLOCK])).toContain(
			CONFLICT_PATHS_COLUMN
		);
	});

	it('refuses a full-width row whose PR cell does not name a PR, naming its line', () => {
		const lines = [PROVENANCE, HEADER, DIVIDER, ROW_WITHOUT_HASH, ...BLOCK];
		expect(reasonFor(lines)).toContain('line 4: "348"');
	});

	it('refuses a row that is not the header\u2019s width, naming its count', () => {
		const lines = [PROVENANCE, HEADER, DIVIDER, '| #348 | t | CLEAN | — | yes | c | d |', ...BLOCK];
		expect(reasonFor(lines)).toContain('#348: 9 cell(s), header has 10');
	});

	it('refuses a table with no provenance line to rewrite', () => {
		expect(reasonFor([HEADER, DIVIDER, CLEAN_ROW, ...BLOCK])).toContain('Last refreshed:');
	});

	// rewriteProvenance updates the first match, so a second line surviving a copy/paste would be left
	// claiming an older base while the run exited 0 — two contradictory bases in the document the table is
	// read as the record of. Exactly one, for the reason the block markers need exactly one of each.
	it('refuses a table carrying two provenance lines', () => {
		const reason = reasonFor([PROVENANCE, PROVENANCE, HEADER, DIVIDER, CLEAN_ROW, ...BLOCK]);
		expect(reason).toContain('Found 2 lines');
	});

	// The abbreviation in the cell is not allowed to be the only record, so a table with nowhere to put
	// the complete list is not measured at all.
	it('refuses a table with nowhere to write every conflicting filename', () => {
		expect(reasonFor([PROVENANCE, HEADER, DIVIDER, CLEAN_ROW])).toContain(
			'cannot be located'
		);
	});
});

describe('fenceFor', () => {
	it('uses a plain fence when no path contains a backtick', () => {
		expect(fenceFor(['plan.md', 'docs/seams.md'])).toBe('```');
	});

	// A filename may contain backticks, and three of them would close the block mid-list — truncating
	// the lossless record at the one character that makes it unreadable.
	it('outgrows the longest backtick run it has to contain', () => {
		expect(fenceFor(['a```b.md'])).toBe('````');
		expect(fenceFor(['a`b.md', 'c`````d.md'])).toBe('``````');
	});
});

describe('renderConflictDetails', () => {
	const measured = [
		{ pr: 348, status: 'CLEAN', conflictPaths: [] },
		{ pr: 296, status: 'CONFLICT', conflictPaths: ['plan.md', EVIDENCE_PATH] }
	];

	// The finding: the cell replaces `src/a.ts` and `src/b.ts` with `src/* (2 files)`, so the table no
	// longer holds the names git gave and a reviewer cannot audit the conflict without rerunning the
	// analyzer. The summary stays — twenty-five paths in a cell is how this column once said nothing at
	// all — and this block is the complete record behind it.
	it('names every path git gave, each on its own line', () => {
		const rendered = renderConflictDetails(measured);
		expect(rendered).toContain('plan.md');
		expect(rendered).toContain(EVIDENCE_PATH);
	});

	it('says how many files and which PR, so an entry can be matched to its row', () => {
		expect(renderConflictDetails(measured)).toContain('<summary>#296 — 2 conflicting files</summary>');
	});

	it('says file, not files, for a single one', () => {
		expect(
			renderConflictDetails([{ pr: 338, status: 'CONFLICT', conflictPaths: ['plan.md'] }])
		).toContain('<summary>#338 — 1 conflicting file</summary>');
	});

	// A fence needs no escaping, which is the point of using one: `escapeCell` is correct in a cell and
	// invisible to a reader who copies the line into a shell, so the block holds the bytes git printed.
	it('leaves a pipe in a filename unescaped, unlike the cell', () => {
		const rendered = renderConflictDetails([
			{ pr: 1, status: 'CONFLICT', conflictPaths: ['a|b.md'] }
		]);
		expect(rendered).toContain('a|b.md');
		expect(escapeCell('a|b.md')).toBe('a\\|b.md');
	});

	it('gives a CLEAN row no entry, because git named nothing', () => {
		expect(renderConflictDetails(measured).join('\n')).not.toContain('#348');
	});

	// measureAgainstMain reports this anomaly in the cell as a failure note; there are no names to list.
	it('gives a conflict that named no files no entry either', () => {
		const rendered = renderConflictDetails([{ pr: 1, status: 'CONFLICT', conflictPaths: [] }]);
		expect(rendered.join('\n')).toContain('git named no files');
		expect(rendered.join('\n')).not.toContain('<details>');
	});

	it('wraps itself in the markers the rewriter looks for', () => {
		const rendered = renderConflictDetails(measured);
		expect(rendered[0]).toBe(CONFLICT_BLOCK_BEGIN);
		expect(rendered.at(-1)).toBe(CONFLICT_BLOCK_END);
	});
});

describe('a filename that looks like this document\u2019s own structure', () => {
	// This script writes filenames into the file it reads. Every path below is legal on the filesystems
	// this runs on, and each one used to be read back as structure rather than as content: the first as a
	// data row, the second as a block marker. Round-tripped through the real writer rather than a
	// hand-built fixture, because the defect was in the reader trusting what the writer had emitted.
	const ROW_SHAPED = '| #999 | not | a | table | row | but | a | filename |';
	const MARKER_SHAPED = CONFLICT_BLOCK_BEGIN;
	const PROVENANCE = 'Last refreshed: **2026-09-12**, against `origin/main` at `f1a8c91`.';
	const hostile = [
		PROVENANCE,
		HEADER,
		DIVIDER,
		'| #348 | t | h | CONFLICT | x | yes | c | d |',
		'',
		...renderConflictDetails([
			{ pr: 348, status: 'CONFLICT', conflictPaths: [ROW_SHAPED, MARKER_SHAPED, 'plan.md'] }
		])
	];

	it('writes all three verbatim, because the block is the complete record', () => {
		expect(hostile).toContain(ROW_SHAPED);
		expect(hostile).toContain(MARKER_SHAPED);
		expect(hostile).toContain('plan.md');
	});

	it('does not read the row-shaped filename as a PR row', () => {
		expect(readTable(hostile)?.prRows).toEqual([{ pr: 348, lineIndex: 3 }]);
	});

	it('does not judge it as a data row with a bad PR cell either', () => {
		const table = readTable(hostile);
		expect(findRowsWithBadPrCell(hostile, table?.headerIndex ?? 0, table?.columns ?? {})).toEqual([]);
	});

	it('does not count the marker-shaped filename as a second begin marker', () => {
		const located = findConflictBlock(hostile);
		expect(located.begin).toBe(5);
		expect(located.end).toBe(hostile.length - 1);
	});

	// The whole point: a refresh that succeeded used to leave a file the next run refuses to read.
	it('still validates, so the refresh it produced is one the next run accepts', () => {
		const table = readTable(hostile);
		expect(table).not.toBeNull();
		expect(validateTable(hostile, table ?? { headerIndex: 0, columns: {}, prRows: [] })).toEqual({
			ok: true
		});
	});
});

describe('tableRowEnd', () => {
	it('stops at the first line that is not a table row', () => {
		expect(tableRowEnd([HEADER, DIVIDER, CLEAN_ROW, '', 'prose'], 0)).toBe(3);
	});

	it('stops at end of file when the table runs to it', () => {
		expect(tableRowEnd([HEADER, DIVIDER, CLEAN_ROW], 0)).toBe(3);
	});

	it('counts an indented continuation row, which markdown does too', () => {
		expect(tableRowEnd([HEADER, DIVIDER, `  ${CLEAN_ROW}`, ''], 0)).toBe(3);
	});
});

describe('fencedLines', () => {
	it('marks the fence delimiters and everything between them', () => {
		expect(fencedLines(['a', '```text', 'x', '```', 'b'])).toEqual([false, true, true, true, false]);
	});

	// fenceFor opens with a run longer than any in the paths, so a path that is itself ``` belongs to the
	// fence's content. A "three or more backticks" test would close the block on it — in exactly the case
	// the adaptive fence exists for.
	it('does not let a shorter run close a longer fence', () => {
		expect(fencedLines(['````text', '```', 'x', '````', 'after'])).toEqual([
			true,
			true,
			true,
			true,
			false
		]);
	});
});

describe('findConflictBlock', () => {
	// Narrowed in a helper rather than by loosening the return type: `begin: null` is the discriminant
	// that stops a caller reading an index that is not there, and the production call sites need it.
	const reasonFor = (located: ReturnType<typeof findConflictBlock>) =>
		located.begin === null ? located.reason : '';

	it('locates a single well-ordered block', () => {
		expect(findConflictBlock(['a', CONFLICT_BLOCK_BEGIN, 'x', CONFLICT_BLOCK_END, 'b'])).toEqual({
			begin: 1,
			end: 3
		});
	});

	it('gives a reason when a marker is missing', () => {
		expect(reasonFor(findConflictBlock(['a', CONFLICT_BLOCK_BEGIN, 'x']))).toContain('exactly one');
	});

	// Rewriting on a guess would swallow whatever sits between the wrong pair of markers — including
	// the table this block exists to explain.
	it('gives a reason for two begin markers', () => {
		expect(
			reasonFor(findConflictBlock([CONFLICT_BLOCK_BEGIN, CONFLICT_BLOCK_BEGIN, CONFLICT_BLOCK_END]))
		).toContain('exactly one');
	});

	it('gives a reason when the end comes first', () => {
		expect(reasonFor(findConflictBlock([CONFLICT_BLOCK_END, CONFLICT_BLOCK_BEGIN]))).toContain(
			'before the begin'
		);
	});
});

describe('rewriteConflictBlock', () => {
	it('replaces the region and leaves every line outside it byte-identical', () => {
		const lines = ['before', CONFLICT_BLOCK_BEGIN, 'stale', CONFLICT_BLOCK_END, 'after'];
		expect(rewriteConflictBlock(lines, [{ pr: 296, status: 'CONFLICT', conflictPaths: ['plan.md'] }])).toBe(
			true
		);
		expect(lines[0]).toBe('before');
		expect(lines.at(-1)).toBe('after');
		expect(lines).toContain('plan.md');
		expect(lines).not.toContain('stale');
	});

	it('writes nothing when there is no block to write into', () => {
		const lines = ['before', 'after'];
		expect(rewriteConflictBlock(lines, [])).toBe(false);
		expect(lines).toEqual(['before', 'after']);
	});
});

/**
 * Read the committed block back into `PR -> every path listed under it`.
 *
 * Written as a parser rather than a regex sweep because the point of the block is that it holds the
 * bytes git printed: a path is whatever sits inside a fence, including one that looks like markup.
 */
const pathsListedPerPr = (lines: string[]) => {
	const block = findConflictBlock(lines);
	const listed = new Map<number, string[]>();
	let current = 0;
	let inFence = false;
	for (const line of lines.slice(block.begin ?? 0, (block.end ?? 0) + 1)) {
		const summary = line.match(/^<summary>#(\d+) —/);
		if (summary) {
			current = Number.parseInt(summary[1], 10);
			listed.set(current, []);
		} else if (/^`{3,}/.test(line)) {
			inFence = !inFence;
		} else if (inFence && current !== 0) {
			listed.get(current)?.push(line);
		}
	}
	return listed;
};

describe('the committed triage table', () => {
	const table = fs.readFileSync(path.resolve('docs/triage-table.md'), 'utf8').split('\n');

	it('has a header this script can find, so a refresh cannot rewrite the wrong cells', () => {
		const header = table.find((line) => parseTableColumns(line)[STATUS_COLUMN] !== undefined);
		expect(header).toBeDefined();
		expect(parseTableColumns(header ?? '')[CONFLICT_PATHS_COLUMN]).toBeDefined();
	});

	it('has every PR row exactly as wide as its header', () => {
		const headerIndex = table.findIndex(
			(line) => parseTableColumns(line)[STATUS_COLUMN] !== undefined
		);
		const prRows = table
			.map((line, lineIndex) => ({ line, lineIndex }))
			.filter(({ line }) => /^\|\s*#\d+\s*\|/.test(line))
			.map(({ lineIndex }) => ({ pr: 0, lineIndex }));
		expect(findMalformedRows(table, headerIndex, prRows)).toEqual([]);
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
			// splitRow, not split('|'): production deliberately supports an escaped pipe in a title, and a
			// raw split here would read the wrong cell and fail the suite over a legitimate title.
			expect(splitRow(row)[dryRunIndex].trim()).toMatch(/^(yes|no)$/i);
		}
	});

	it('holds exactly CLEAN or CONFLICT in the status cell of every PR row', () => {
		const header = table.find((line) => parseTableColumns(line)[STATUS_COLUMN] !== undefined) ?? '';
		const statusIndex = parseTableColumns(header)[STATUS_COLUMN];
		const prRows = table.filter((line) => /^\|\s*#\d+\s*\|/.test(line));
		expect(prRows.length).toBeGreaterThan(0);
		for (const row of prRows) {
			expect(splitRow(row)[statusIndex].trim()).toMatch(/^(CLEAN|CONFLICT)$/);
		}
	});

	it('carries one well-ordered block for the analyzer to write every filename into', () => {
		expect(findConflictBlock(table).begin).not.toBeNull();
	});

	// The abbreviation and the complete list are written in one run from one measurement, so they cannot
	// disagree — unless someone edits one by hand, which is what this reads the real file to catch. Every
	// `dir/* (N files)` in a cell must have exactly N paths under that directory in the block, and every
	// filename the cell spells out must appear there too.
	// The cell and the block are written from one measurement in one run, so they cannot disagree unless
	// someone edits one by hand — which is what this reads the real file to catch. Checked by *generating*
	// the cell from the block's paths and comparing, rather than parsing the cell apart: an earlier version
	// split it on comma-space, and a conflicted file legitimately named `a, b.md` would have been written
	// correctly into both places and then read here as two entries, failing `npm test` and making a valid
	// refresh impossible to commit. A test that cannot accept a legal filename is a worse test than none.
	it('expands every abbreviated cell into the same files the block names', () => {
		const listed = pathsListedPerPr(table);
		expect(listed.size).toBeGreaterThan(0);
		const columns = parseTableColumns(
			table.find((line) => parseTableColumns(line)[STATUS_COLUMN] !== undefined) ?? ''
		);
		let compared = 0;
		for (const row of table.filter((line) => /^\|\s*#\d+\s*\|/.test(line))) {
			const cells = splitRow(row);
			if (cells[columns[STATUS_COLUMN]].trim() !== 'CONFLICT') {
				continue;
			}
			const pr = Number.parseInt(cells[columns[PR_COLUMN]].trim().slice(1), 10);
			const paths = listed.get(pr) ?? [];
			expect(paths.length).toBeGreaterThan(0);
			expect(cells[columns[CONFLICT_PATHS_COLUMN]].trim()).toBe(
				escapeCell(summarizeConflictPaths(paths))
			);
			compared += 1;
		}
		expect(compared).toBeGreaterThan(0);
	});
});
