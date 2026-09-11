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
 * Map the table's header names to their index in `line.split('|')`.
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
  headerLine.split('|').forEach((cell, index) => {
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
  const parts = originalLine.split('|');
  const statusIndex = columns[STATUS_COLUMN];
  if (statusIndex !== undefined && statusIndex < parts.length) {
    parts[statusIndex] = ` ${measured.status} `;
  }
  const pathsIndex = columns[CONFLICT_PATHS_COLUMN];
  if (pathsIndex !== undefined && pathsIndex < parts.length) {
    const detail = measured.failureNote ?? summarizeConflictPaths(measured.conflictPaths);
    parts[pathsIndex] = ` ${detail.replaceAll('|', '/')} `;
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
 * Measure one PR's head against `origin/main`, without touching the working tree.
 *
 * @param {number} pr
 * @returns {{ status: 'CLEAN' | 'CONFLICT', conflictPaths: string[], failureNote?: string } | null}
 *          null when the PR's head could not be fetched, so its row is left alone.
 */
export const measureAgainstMain = (pr) => {
  const head = `refs/pr-analysis/${pr}`;
  if (!runCommand(`git fetch --force origin pull/${pr}/head:${head}`).success) {
    return null;
  }
  // merge-tree is read-only: no checkout, no temporary branch, no clean-worktree requirement.
  const merge = runCommand(`git merge-tree --write-tree --name-only origin/main ${head}`);
  runCommand(`git update-ref -d ${head}`);

  if (merge.success) {
    return { status: 'CLEAN', conflictPaths: [] };
  }
  // Non-zero from merge-tree means either "conflicts" or "this did not run". Only the first prints a
  // tree id on stdout, and only the first is a measurement worth writing into the table.
  const conflictPaths = parseConflictPaths(merge.stdout);
  if (conflictPaths === null) {
    const collapsed = merge.stderr.replaceAll(/\s+/g, ' ').trim();
    return {
      status: 'CONFLICT',
      conflictPaths: [],
      failureNote: `merge-tree did not run: ${collapsed}`
    };
  }
  return {
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
  if (columns[CONFLICT_PATHS_COLUMN] === undefined) {
    console.warn(
      `[WARNING] No "${CONFLICT_PATHS_COLUMN}" column; conflicting files will not be recorded.`
    );
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

  for (const row of prRows) {
    const measured = measureAgainstMain(row.pr);
    if (measured === null) {
      console.warn(`[WARNING] Failed to fetch PR #${row.pr}. Leaving its row untouched.`);
      continue;
    }
    lines[row.lineIndex] = rewriteRow(lines[row.lineIndex], columns, measured);
    const fileCount = measured.conflictPaths.length;
    const detail = fileCount > 0 ? ` (${fileCount} file(s))` : '';
    console.log(`-> PR #${row.pr} is ${measured.status}${detail}.`);
  }

  if (!rewriteProvenance(lines, { date: toDateFolder(new Date()), base: baseSha })) {
    console.warn(
      `[WARNING] No line starting "${PROVENANCE_PREFIX}" to update; the table will not say which ` +
        'base these statuses were measured against.'
    );
  }

  fs.writeFileSync(TRIAGE_TABLE_PATH, lines.join('\n'));
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
