/**
 * Purpose: Measure every open PR in docs/triage-table.md against origin/main and write the result
 *          back into that table's own merge-status and conflicting-paths columns.
 * Why: The table is the triage source of truth and this script is its only writer. It used to
 *      address columns by fixed index (`parts[5]` was assumed to be a bucket, `parts[6]` was
 *      overwritten with a merge note) and to test each merge from whatever branch happened to be
 *      checked out. Both were silent: a table whose columns had moved lost a human's disposition on
 *      the next run, and a stale local `main` produced statuses measured against a base the table
 *      did not name.
 * Info flow: docs/triage-table.md (PR numbers + header row) -> git merge-tree against origin/main ->
 *            the same table, with only the two columns this script owns rewritten.
 */

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { execSync } from 'node:child_process';
import { isEntryPoint, toDateFolder } from './evidence-reporting.mjs';

const TRIAGE_TABLE_PATH = path.resolve('docs/triage-table.md');

/**
 * The table's provenance line, which this script also owns.
 *
 * It claims a date and a base commit, and until a review caught it the script rewrote the measured
 * cells without touching this line — so a refresh after `origin/main` advanced left a table whose
 * statuses were measured against one commit while its own header named an older one. A provenance
 * line that can go stale is worse than none, because it is read as the thing that makes the
 * measurement reproducible.
 */
const PROVENANCE_PREFIX = 'Last refreshed:';

/** The banner this tool prints around its own output, four times. */
const BANNER = '='.repeat(50);

/** The two columns this script writes. Everything else in a row belongs to whoever wrote it. */
export const STATUS_COLUMN = 'merge status';
export const CONFLICT_PATHS_COLUMN = 'conflicting paths';

/**
 * Run a git command, returning its output either way rather than throwing.
 *
 * `stdout` and `stderr` are kept apart as well as combined. That is not tidiness: `output` used to be
 * the only field, and on an operational failure - an invalid ref, an option this git does not know -
 * it began with an empty line where stdout would have been, so `parseConflictPaths` dropped that line
 * as if it were the tree id and read the *stderr message* as a conflicting filename. The table then
 * recorded `CONFLICT` with an error string under conflicting paths, which is a measurement the
 * command never made.
 *
 * @param {string} command
 * @returns {{ success: boolean, output: string, stdout: string, stderr: string }}
 */
export function runCommand(command) {
  try {
    const stdout = execSync(command, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
    return { success: true, output: stdout.trim(), stdout: stdout.trim(), stderr: '' };
  } catch (error) {
    // execSync throws an Error carrying the child's captured streams. Narrowed here rather than
    // dereferenced off `unknown`, which is what the typechecker reported once a test imported this
    // file and pulled it into the checked graph.
    const failure = /** @type {{ stdout?: string, stderr?: string, message?: string }} */ (error);
    const stdout = (failure.stdout ?? '').trim();
    const stderr = (failure.stderr ?? '').trim();
    return {
      success: false,
      output: `${failure.stdout ?? ''}\n${failure.stderr ?? ''}\n${failure.message ?? ''}`,
      stdout,
      stderr: stderr.length > 0 ? stderr : (failure.message ?? '')
    };
  }
}

/**
 * Split a markdown table row into its cells, honouring `\|` escapes.
 *
 * A pipe inside a cell must be written `\|`, and a plain `split('|')` treats it as a separator - so
 * one PR title containing an escaped pipe shifted every cell after it. The selection then read the
 * Head cell as the status and found no candidates, and `rewriteRow` wrote `CONFLICT` **into the Head
 * column**, silently corrupting the row it was asked to refresh.
 *
 * Round-trips: the pieces keep their `\|` sequences, so `parts.join('|')` reproduces the input
 * exactly, which is what lets `rewriteRow` replace two cells and leave the rest byte-identical.
 *
 * @param {string} line
 * @returns {string[]}
 */
export const splitRow = (line) => line.split(/(?<!\\)\|/);

/**
 * Make text safe to put in a table cell, without altering what it says.
 *
 * A conflicted filename may legitimately contain a pipe. This used to replace it with `/`, which
 * records `a/b.md` for `a|b.md` — a different file, in the column a reader trusts to name files.
 * Escaping keeps the name and `splitRow` reads it back as one cell. Backslashes are escaped first, so
 * escaping cannot be undone by a backslash already in the name.
 *
 * @param {string} text
 * @returns {string}
 */
export const escapeCell = (text) => text.replaceAll('\\', '\\\\').replaceAll('|', '\\|');

/**
 * Map the table's header names to their index in `splitRow(line)`.
 *
 * By name rather than by position, because the previous version hard-coded positions and a later
 * edit to the table's columns therefore rewrote the wrong cells without failing. A header this
 * script does not recognise is simply absent from the map, and `rewriteRow` leaves that cell alone.
 *
 * @param {string} headerLine A markdown table header row, pipes included.
 * @returns {Record<string, number>} normalized header name -> index into the split parts
 */
export const parseTableColumns = (headerLine) => {
  /** @type {Record<string, number>} */
  const columns = {};
  splitRow(headerLine).forEach((cell, index) => {
    const name = cell.trim().replace(/`/g, '').toLowerCase();
    if (name.length > 0 && !(name in columns)) {
      columns[name] = index;
    }
  });
  return columns;
};

/**
 * Rewrite one PR row's measured columns, leaving every other cell byte-identical.
 *
 * The status cell holds exactly `CLEAN` or `CONFLICT` — nothing else, so the value stays readable
 * by anything that compares it. Which files conflicted is a separate fact and lives in its own
 * column; when the table has no such column the paths are dropped rather than smuggled into the
 * status.
 *
 * @param {string} originalLine
 * @param {Record<string, number>} columns
 * @param {{ status: 'CLEAN' | 'CONFLICT', conflictPaths: string[], failureNote?: string }} measured
 * @returns {string}
 */
export const rewriteRow = (originalLine, columns, measured) => {
  const parts = splitRow(originalLine);
  const statusIndex = columns[STATUS_COLUMN];
  if (statusIndex !== undefined && statusIndex < parts.length) {
    parts[statusIndex] = ` ${measured.status} `;
  }
  const pathsIndex = columns[CONFLICT_PATHS_COLUMN];
  if (pathsIndex !== undefined && pathsIndex < parts.length) {
    const detail = measured.failureNote ?? summarizeConflictPaths(measured.conflictPaths);
    parts[pathsIndex] = ` ${escapeCell(detail)} `;
  }
  return parts.join('|');
};

/**
 * Parse the **stdout** of `git merge-tree --write-tree --name-only` for a conflicted merge.
 *
 * The first line is the tree object id; the conflicted paths follow, one per line, until the blank
 * line separating them from git's own messages.
 *
 * Returns `null` rather than `[]` when the first line is not a tree id, because the two mean opposite
 * things and this function used to conflate them. A clean merge and a conflicted one both print an id;
 * a command that failed operationally prints nothing on stdout, and treating that as "a conflicted
 * merge with no files named" is how an invalid ref got recorded as a real CONFLICT measurement.
 *
 * @param {string} stdout the command's stdout alone - never stdout and stderr combined
 * @returns {string[] | null} the conflicted paths, or null if this is not a merge-tree result
 */
export const parseConflictPaths = (stdout) => {
  const [treeId, ...rest] = stdout.split('\n');
  if (!/^[0-9a-f]{40}$/.test(treeId.trim())) {
    return null;
  }
  /** @type {string[]} */
  const paths = [];
  for (const line of rest) {
    if (line.trim().length === 0) {
      break;
    }
    paths.push(line.trim());
  }
  return paths;
};

/**
 * Render a conflicting-path list short enough to read in a table cell.
 *
 * A stale PR conflicts on its whole dated evidence folder, so the raw list runs to twenty-five
 * paths and the cell becomes unreadable — which is how the column ended up saying nothing at all in
 * the version of this script that wrote `Has conflicts: .` Any directory contributing more than one
 * conflicting file collapses to `dir/* (N files)`; a directory contributing one keeps its filename,
 * because `docs/seams.md` is a different kind of news from twelve regenerated JSON reports.
 *
 * @param {string[]} paths
 * @returns {string}
 */
export const summarizeConflictPaths = (paths) => {
  if (paths.length === 0) {
    return '—';
  }
  /** @type {Map<string, string[]>} */
  const byDirectory = new Map();
  for (const filePath of paths) {
    const slash = filePath.lastIndexOf('/');
    const directory = slash === -1 ? '' : filePath.slice(0, slash);
    byDirectory.set(directory, [...(byDirectory.get(directory) ?? []), filePath]);
  }
  return [...byDirectory.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .flatMap(([directory, files]) =>
      files.length > 1 && directory !== ''
        ? [`${directory}/* (${files.length} files)`]
        : [...files].sort((a, b) => a.localeCompare(b))
    )
    .join(', ');
};

/**
 * Squash a multi-line git error into one line, so it fits a table cell or a log line.
 *
 * @param {string} text
 * @returns {string}
 */
const collapse = (text) => text.replaceAll(/\s+/g, ' ').trim();

/**
 * Locate the table's header, its column map, and every PR row beneath it.
 *
 * Separated from `main` so it can be tested against a table without running git, and because the
 * cost of getting it wrong is a rewritten disposition rather than a visible error.
 *
 * @param {string[]} lines
 * @returns {{ headerIndex: number, columns: Record<string, number>, prRows: { pr: number, lineIndex: number }[] } | null}
 *          null when no `Merge status` column exists, which is the one case where guessing is worse
 *          than refusing.
 */
export const readTable = (lines) => {
  const headerIndex = lines.findIndex(
    (line) => parseTableColumns(line)[STATUS_COLUMN] !== undefined
  );
  if (headerIndex === -1) {
    return null;
  }
  /** @type {{ pr: number, lineIndex: number }[]} */
  const prRows = [];
  for (let index = headerIndex + 1; index < lines.length; index += 1) {
    const match = lines[index].match(/^\|\s*#(\d+)\s*\|/);
    if (match) {
      prRows.push({ pr: Number.parseInt(match[1], 10), lineIndex: index });
    }
  }
  return { headerIndex, columns: parseTableColumns(lines[headerIndex]), prRows };
};

/**
 * Which PR rows are not exactly as wide as the header.
 *
 * **Width equality, not "long enough".** The first version of this checked only that the columns this
 * script writes were in range, which missed a deleted *interior* cell: remove `Head` and the row still
 * has cells at indexes 4 and 5, so nothing was rejected - but they are now the *wrong* cells, and
 * `rewriteRow` wrote the status into the old conflicting-paths cell and the paths over a human's
 * `Dry-run` answer. Every index in the map is derived from the header, so any width but the header's
 * makes all of them wrong at once; there is no useful weaker check.
 *
 * A trailing-truncated row (`| #317 | title |`) is the same defect, and is caught by the same rule:
 * `rewriteRow` guards an out-of-range index and therefore does nothing, quietly, while `refreshRows`
 * counted the row as measured. Checked before any measurement, so a malformed table costs no git work.
 *
 * @param {string[]} lines
 * @param {number} headerIndex
 * @param {{ pr: number, lineIndex: number }[]} prRows
 * @returns {{ pr: number, cells: number, expected: number }[]}
 */
export const findMalformedRows = (lines, headerIndex, prRows) => {
  const expected = splitRow(lines[headerIndex]).length;
  return prRows
    .map((row) => ({ pr: row.pr, cells: splitRow(lines[row.lineIndex]).length, expected }))
    .filter(({ cells }) => cells !== expected);
};

/**
 * Measure one PR's head against `origin/main`, without touching the working tree.
 *
 * Returns a *reason* on failure rather than a bare null, and `CONFLICT` only when git actually
 * performed a merge and refused it. An earlier version turned "merge-tree did not run" into a
 * `CONFLICT` carrying the error as a note, which `refreshRows` then counted as a measured row: the
 * table would have recorded a conflict, rewritten the provenance line and exited 0 for a command that
 * never compared anything. `CONFLICT` in this table means git named conflicting files.
 *
 * @param {number} pr
 * @returns {{ ok: true, status: 'CLEAN' | 'CONFLICT', conflictPaths: string[], failureNote?: string }
 *          | { ok: false, reason: string }}
 */
export const measureAgainstMain = (pr) => {
  const head = `refs/pr-analysis/${pr}`;
  const fetched = runCommand(`git fetch --force origin pull/${pr}/head:${head}`);
  if (!fetched.success) {
    return { ok: false, reason: `could not fetch its head: ${collapse(fetched.stderr)}` };
  }
  // merge-tree is read-only: no checkout, no temporary branch, no clean-worktree requirement.
  const merge = runCommand(`git merge-tree --write-tree --name-only origin/main ${head}`);
  runCommand(`git update-ref -d ${head}`);

  if (merge.success) {
    return { ok: true, status: 'CLEAN', conflictPaths: [] };
  }
  // Non-zero from merge-tree means either "conflicts" or "this did not run". Only the first prints a
  // tree id on stdout, and only the first is a measurement worth writing into the table.
  const conflictPaths = parseConflictPaths(merge.stdout);
  if (conflictPaths === null) {
    return { ok: false, reason: `merge-tree did not run: ${collapse(merge.stderr)}` };
  }
  return {
    ok: true,
    status: 'CONFLICT',
    conflictPaths,
    failureNote:
      conflictPaths.length === 0
        ? 'merge-tree reported a conflict but named no files'
        : undefined
  };
};

/**
 * Rewrite the table's provenance line to the date and base this run actually measured against.
 *
 * @param {string[]} lines mutated in place, as the row rewrites already are
 * @param {{ date: string, base: string }} measured
 * @returns {boolean} whether a provenance line was found to rewrite
 */
export const rewriteProvenance = (lines, { date, base }) => {
  const index = lines.findIndex((line) => line.startsWith(PROVENANCE_PREFIX));
  if (index === -1) {
    return false;
  }
  lines[index] = `${PROVENANCE_PREFIX} **${date}**, against \`origin/main\` at \`${base}\`.`;
  return true;
};

/**
 * Refresh every PR row, or none of them.
 *
 * All-or-nothing because the provenance line makes a claim about the **whole** table: measured on
 * this date against this base. A run that skipped one unfetchable row and wrote the rest still
 * rewrote that line, so the table presented a mixture of old and new measurements as one refresh and
 * exited 0 — the reader has no way to tell which row is which. A partial refresh is not a refresh.
 *
 * The measurement is injected rather than called directly, so a test can drive the skip path without
 * needing a PR that cannot be fetched.
 *
 * @param {string[]} lines
 * @param {Record<string, number>} columns
 * @param {{ pr: number, lineIndex: number }[]} prRows
 * @param {(pr: number) => ReturnType<typeof measureAgainstMain>} measure
 * @returns {{ lines: string[] | null, skipped: { pr: number, reason: string }[], measured: { pr: number, status: string, fileCount: number }[] }}
 *          `lines` is null when anything was skipped: there is nothing safe to write. Each skip keeps
 *          its reason, because "could not measure #348" without saying why sends the next reader back
 *          to run the command by hand.
 */
export const refreshRows = (lines, columns, prRows, measure) => {
  const next = [...lines];
  /** @type {{ pr: number, reason: string }[]} */
  const skipped = [];
  /** @type {{ pr: number, status: string, fileCount: number }[]} */
  const measured = [];
  for (const row of prRows) {
    const result = measure(row.pr);
    if (!result.ok) {
      skipped.push({ pr: row.pr, reason: result.reason });
      continue;
    }
    next[row.lineIndex] = rewriteRow(next[row.lineIndex], columns, result);
    measured.push({ pr: row.pr, status: result.status, fileCount: result.conflictPaths.length });
  }
  return { lines: skipped.length > 0 ? null : next, skipped, measured };
};

async function main() {
  console.log(BANNER);
  console.log('PR Merge Conflict Analyzer');
  console.log(`${BANNER}\n`);

  if (!fs.existsSync(TRIAGE_TABLE_PATH)) {
    console.error(`Triage table not found at: ${TRIAGE_TABLE_PATH}`);
    process.exit(1);
  }

  const lines = fs.readFileSync(TRIAGE_TABLE_PATH, 'utf8').split('\n');
  const table = readTable(lines);
  if (table === null) {
    console.error(
      `No "${STATUS_COLUMN}" column found in the triage table header. Refusing to guess which ` +
        'cells to rewrite — add the column or fix its spelling.'
    );
    process.exit(1);
  }
  const { columns, prRows } = table;
  // Required, not optional. Warning and continuing would update every status and the provenance line
  // while leaving the old path cells in place — statuses measured against the new base sitting beside
  // conflict details from an older refresh, with nothing to mark them stale.
  if (columns[CONFLICT_PATHS_COLUMN] === undefined) {
    console.error(
      `No "${CONFLICT_PATHS_COLUMN}" column found in the triage table header. This column is the ` +
        "analyzer's to write, so a refresh without it would leave stale path cells beside fresh " +
        'statuses. Nothing measured, nothing written — add the column or fix its spelling.'
    );
    process.exit(1);
  }
  const malformed = findMalformedRows(lines, table.headerIndex, prRows);
  if (malformed.length > 0) {
    console.error('These PR rows do not have the same number of cells as the header:');
    for (const row of malformed) {
      console.error(`  #${row.pr}: ${row.cells} cell(s), header has ${row.expected}`);
    }
    console.error(
      'Every column index comes from the header, so a row of a different width puts every cell in ' +
        'the wrong place — the status into another column, the paths over a human\'s decision — or ' +
        'silently nowhere. Nothing measured, nothing written; repair the rows.'
    );
    process.exit(1);
  }
  if (lines.findIndex((line) => line.startsWith(PROVENANCE_PREFIX)) === -1) {
    console.error(
      `No line starting "${PROVENANCE_PREFIX}" found. Without it the table would carry fresh ` +
        'statuses and no record of the date or base they were measured against, which is the ' +
        'reproducibility this refresh exists to provide. Nothing measured, nothing written.'
    );
    process.exit(1);
  }
  if (prRows.length === 0) {
    console.log('No PR rows found in triage table.');
    process.exit(0);
  }

  // Against origin/main, refreshed here, rather than against the checked-out branch. The base is
  // named in the table, so measuring from a stale or unrelated checkout made the table lie.
  const fetched = runCommand('git fetch origin main');
  if (!fetched.success) {
    console.error(`[ERROR] Could not fetch origin/main:\n${fetched.output}`);
    process.exit(1);
  }
  const baseSha = runCommand('git rev-parse --short origin/main').output;
  console.log(`Measuring ${prRows.length} PRs against origin/main (${baseSha}).\n`);

  const refreshed = refreshRows(lines, columns, prRows, measureAgainstMain);
  for (const row of refreshed.measured) {
    const detail = row.fileCount > 0 ? ` (${row.fileCount} file(s))` : '';
    console.log(`-> PR #${row.pr} is ${row.status}${detail}.`);
  }

  if (refreshed.lines === null) {
    console.error(`\n[ERROR] Could not measure ${refreshed.skipped.length} PR(s):`);
    for (const skip of refreshed.skipped) {
      console.error(`  #${skip.pr}: ${skip.reason}`);
    }
    console.error(
      'Nothing written: the table is unchanged and still says which base it was measured against. ' +
        'A refresh that skipped a row would present old and new measurements as one, with no way to ' +
        'tell them apart. Fix the cause above, or remove a row that no longer names a fetchable PR.'
    );
    process.exit(1);
  }

  // Checked before measuring too, so this cannot normally fire. Kept as a guard rather than a warning
  // because writing rows without it is the one outcome this whole refresh must not produce.
  if (!rewriteProvenance(refreshed.lines, { date: toDateFolder(new Date()), base: baseSha })) {
    console.error(
      `No line starting "${PROVENANCE_PREFIX}" to update. Nothing written: fresh statuses with no ` +
        'record of the base they were measured against are worse than none.'
    );
    process.exit(1);
  }

  fs.writeFileSync(TRIAGE_TABLE_PATH, refreshed.lines.join('\n'));
  console.log(`\n${BANNER}`);
  console.log('Conflict analysis complete.');
  console.log(`Updated triage table: ${TRIAGE_TABLE_PATH}`);
  console.log(BANNER);
}

// Guarded so a test can import the helpers above without running the analyzer and rewriting the
// triage table as a side effect of the suite.
if (isEntryPoint(import.meta.url)) {
  main().catch(console.error);
}
