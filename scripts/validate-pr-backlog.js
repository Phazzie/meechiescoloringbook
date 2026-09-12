/**
 * Purpose: Automate the check-out and verification of clean PR candidates from the triage table.
 * Why: Eliminate manual checking and verify pull requests against local tests programmatically.
 * Info flow: docs/triage-table.md -> validate-pr-backlog.js -> git / npm verify commands -> docs/evidence/YYYY-MM-DD/pr-dry-run-summary.md.
 */

import fs from 'node:fs';
import path from 'node:path';
import {
  PR_COLUMN,
  STATUS_COLUMN,
  findDuplicateColumns,
  findMalformedRows,
  malformedRowLabel,
  findRowsWithBadPrCell,
  readTable,
  runCommand,
  splitRow
} from './analyze-merge-conflicts.js';
import { isEntryPoint } from './evidence-reporting.mjs';

// Configuration
const TRIAGE_TABLE_PATH = path.resolve('docs/triage-table.md');
const EVIDENCE_BASE_DIR = path.resolve('docs/evidence');

function getTodayString() {
  const date = new Date();
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

/** The column a human uses to say whether a PR should be dry-run validated at all. */
export const DRY_RUN_COLUMN = 'dry-run';

/**
 * Which PRs in the triage table are worth checking out and validating locally.
 *
 * **Two conditions, because they are two different facts and the retired bucket vocabulary conflated
 * them.** "1. Safe candidate for dry-run" meant *both* "merges cleanly" and "we want this validated",
 * and the first version of this function kept only the mechanical half — so a PR that merges cleanly
 * but is marked **Superseded** was still selected, and `dryRunPr` would report "All checks green.
 * Ready to merge." about a row that says do not merge it. #348 was exactly that case.
 *
 * - `Merge status` is `CLEAN`: measured by `analyze-merge-conflicts.js`, never typed.
 * - `Dry-run` is `yes`: a human's decision, which no script writes.
 *
 * Searching the disposition prose for "Superseded" would work today and is the same
 * literal-matching that broke this function in the first place. An explicit column is the signal.
 *
 * @param {string[]} lines
 * @returns {{ candidates: number[], reason?: string }} `reason` is set when the table could not be
 *          read at all, so the caller can say why rather than report an empty backlog.
 */
export const selectCleanCandidates = (lines) => {
  const table = readTable(lines);
  if (table === null) {
    return { candidates: [], reason: `no "${STATUS_COLUMN}" column in the triage table` };
  }
  // Checked before any cell is read, because a duplicated header makes every later read unsound rather
  // than merely wrong in one place. `parseTableColumns` keeps the first index for a repeated name, so a
  // header carrying `Dry-run` twice lets one row answer `yes` and `no` at once and the *earlier* column
  // wins silently — on the one column that decides whether this tool reports a PR ready to merge. The
  // analyzer already refused its own duplicated columns; the names differ per reader, which is the only
  // reason this call names its three.
  const duplicated = findDuplicateColumns(lines[table.headerIndex], [
    PR_COLUMN,
    STATUS_COLUMN,
    DRY_RUN_COLUMN
  ]);
  if (duplicated.length > 0) {
    return {
      candidates: [],
      reason:
        `these columns appear more than once in the header: ${duplicated.join(', ')}. Every index ` +
        'comes from the first copy, so a second one holding a different answer would be read as ' +
        'though it were not there — including a contradictory Dry-run decision'
    };
  }
  // Without it no row is recognised at all, and `prRows` is empty: the filter below then finds nothing
  // and returns no reason, which reads as a legitimately empty backlog for a table that simply spells
  // its first column differently.
  if (table.columns[PR_COLUMN] === undefined) {
    return {
      candidates: [],
      reason:
        `no "${PR_COLUMN}" column in the triage table. Rows are identified by that cell, so without ` +
        'it no row can be recognised and an empty selection would say nothing about the backlog'
    };
  }
  // The analyzer rejects a row whose width does not match the header; this reader must too. It is the
  // *same* malformed row, and a row of the wrong width shifts every index — so without this the
  // selection reads the wrong cells, finds nothing, returns no reason, and `main` exits 0 as though
  // the backlog were legitimately empty. A rule a parser gains belongs to every reader of the format.
  //
  // Width first, and over every row of the table rather than the recognised ones: a row both too narrow
  // and missing its `#` is invisible to a check that needs the cell parsed and to one that needs the
  // width right, so it has to be judged by the check that needs neither.
  const malformed = findMalformedRows(lines, table.headerIndex);
  if (malformed.length > 0) {
    const named = malformed
      .map((row) => `${malformedRowLabel(row)} (${row.cells} cells)`)
      .join(', ');
    return {
      candidates: [],
      reason:
        `these rows are not the header's width: ${named}. Every column index comes from the header, ` +
        'so their cells cannot be read in the right places'
    };
  }
  // The same hole the analyzer was fixed for, in the second reader: a full-width data row written `348`
  // instead of `#348` does not parse as a PR, so it never reaches `prRows` and the selection is silently
  // short by one — a PR the table says to validate, never validated.
  const badPrCells = findRowsWithBadPrCell(lines, table.headerIndex, table.columns);
  if (badPrCells.length > 0) {
    const named = badPrCells.map((row) => `line ${row.lineIndex + 1} ("${row.cell}")`).join(', ');
    return {
      candidates: [],
      reason:
        `these rows are the header's width but their PR cell does not name a PR: ${named}. A ` +
        'full-width row is a data row, so leaving it out would shorten the selection with no sign of it'
    };
  }
  const dryRunIndex = table.columns[DRY_RUN_COLUMN];
  if (dryRunIndex === undefined) {
    return {
      candidates: [],
      reason:
        `no "${DRY_RUN_COLUMN}" column in the triage table. Selecting on ${STATUS_COLUMN} alone ` +
        'would validate PRs the table says not to merge, so nothing is selected'
    };
  }
  // splitRow, not split('|'): an escaped pipe in a PR title otherwise shifts every cell after it and
  // this reads the Head column as the merge status.
  const cellAt = (/** @type {number} */ lineIndex, /** @type {number} */ column) =>
    splitRow(lines[lineIndex])[column]?.trim().toLowerCase();

  // The analyzer owns this column and writes exactly CLEAN or CONFLICT. A blank or corrupted value —
  // `CLEEN`, or an empty cell after a bad edit — merely excluded the row from the filter, with no
  // reason, so the tool reported an empty backlog and exited 0. A value this column cannot hold means
  // the table is malformed, not that the PR is uninteresting.
  const unmeasured = table.prRows
    .map((row) => ({ pr: row.pr, status: cellAt(row.lineIndex, table.columns[STATUS_COLUMN]) }))
    .filter(({ status }) => status !== 'clean' && status !== 'conflict');
  if (unmeasured.length > 0) {
    const named = unmeasured.map((row) => `#${row.pr} ("${row.status ?? ''}")`).join(', ');
    return {
      candidates: [],
      reason:
        `these rows do not hold a measured ${STATUS_COLUMN}: ${named}. That column is the analyzer's ` +
        'and holds exactly CLEAN or CONFLICT, so any other value means the table is malformed'
    };
  }

  // A mistyped answer is not an answer. `yse` compared unequal to 'yes' and therefore read as a
  // deliberate `no` — and if it were the only candidate the tool reported an empty backlog and exited
  // 0, which is the same silence this file has now been fixed for twice by other routes. This column
  // is a human's decision, so the one thing it must not do is guess which decision a typo meant.
  const unanswered = table.prRows
    .map((row) => ({ pr: row.pr, answer: cellAt(row.lineIndex, dryRunIndex) }))
    .filter(({ answer }) => answer !== 'yes' && answer !== 'no');
  if (unanswered.length > 0) {
    const named = unanswered.map((row) => `#${row.pr} ("${row.answer ?? ''}")`).join(', ');
    return {
      candidates: [],
      reason:
        `these rows do not answer "${DRY_RUN_COLUMN}" with yes or no: ${named}. That column is a ` +
        'decision, and a value that is neither cannot be read as either'
    };
  }

  const candidates = table.prRows
    .filter(
      (row) =>
        cellAt(row.lineIndex, table.columns[STATUS_COLUMN]) === 'clean' &&
        cellAt(row.lineIndex, dryRunIndex) === 'yes'
    )
    .map((row) => row.pr);
  return { candidates };
};

/**
 * Check out one PR, run the suite and the verify chain against it, and return its report row.
 *
 * @param {number} pr
 * @param {{ evidenceDir: string, originalBranch: string }} context
 * @returns {string} one markdown table row
 */
const dryRunPr = (pr, { evidenceDir, originalBranch }) => {
  console.log('\n--------------------------------------------------');
  console.log(`PR #${pr}: Fetching and checking out...`);
  console.log('--------------------------------------------------');

  const tempBranch = `pr-${pr}-dryrun-temp`;
  // Clean up if the temp branch survived a past run.
  runCommand(`git branch -D ${tempBranch}`);

  const fetchResult = runCommand(`git fetch origin pull/${pr}/head:${tempBranch}`);
  if (!fetchResult.success) {
    console.error(`[FAIL] Fetch failed for PR #${pr}.`);
    const detail = fetchResult.output.replaceAll('\n', '<br>');
    return `| #${pr} | ❌ Fetch Failed | - | - | ❌ FAILED | Fetch output: ${detail} |\n`;
  }

  const checkoutResult = runCommand(`git checkout ${tempBranch}`);
  if (!checkoutResult.success) {
    console.error(`[FAIL] Checkout failed for PR #${pr}.`);
    runCommand(`git branch -D ${tempBranch}`);
    const detail = checkoutResult.output.replaceAll('\n', '<br>');
    return `| #${pr} | ❌ Checkout Failed | - | - | ❌ FAILED | Checkout output: ${detail} |\n`;
  }

  console.log(`PR #${pr}: Running npm test...`);
  const testResult = runCommand('npm test');
  console.log(`PR #${pr}: Running npm run verify...`);
  const verifyResult = runCommand('npm run verify');
  const green = testResult.success && verifyResult.success;

  if (green) {
    console.log(`[PASS] PR #${pr} passed all validation tests!`);
  } else {
    console.error(`[FAIL] PR #${pr} failed validation tests.`);
  }

  const notes = [];
  if (!testResult.success) {
    notes.push('Test failures logged.');
    fs.writeFileSync(path.join(evidenceDir, `pr-${pr}-npm-test-fail.log`), testResult.output);
  }
  if (!verifyResult.success) {
    notes.push('Verify checks failed.');
    fs.writeFileSync(path.join(evidenceDir, `pr-${pr}-npm-verify-fail.log`), verifyResult.output);
  }

  console.log(`PR #${pr}: Cleaning up...`);
  runCommand(`git checkout ${originalBranch}`);
  runCommand(`git branch -D ${tempBranch}`);

  const testStatus = testResult.success ? '✅ PASS' : '❌ FAIL';
  const verifyStatus = verifyResult.success ? '✅ PASS' : '❌ FAIL';
  const finalResult = green ? '✅ VERIFIED' : '❌ FAILED';
  const noteText = green ? 'All checks green. Ready to merge.' : notes.join(' ');
  return `| #${pr} | ✅ Success | ${testStatus} | ${verifyStatus} | **${finalResult}** | ${noteText} |\n`;
};

async function main() {
  console.log('==================================================');
  console.log('PR Backlog Dry-Run Validation Tool');
  console.log('==================================================\n');

  // 1. Verify working directory is clean
  console.log('[Step 1] Checking git working tree status...');
  const statusResult = runCommand('git status --porcelain');
  if (!statusResult.success) {
    console.error('Failed to run git status. Exiting.');
    process.exit(1);
  }
  const statusLines = statusResult.output.split('\n').filter(line => line.trim().length > 0 && !line.startsWith('??'));
  if (statusLines.length > 0) {
    console.error('ERROR: Your git working tree has uncommitted modifications:\n');
    console.error(statusLines.join('\n'));
    console.error('\nPlease stash, commit, or revert changes before running dry-run.');
    process.exit(1);
  }
  console.log('Working tree is clean. Proceeding.\n');

  // 2. Parse candidate PRs from docs/triage-table.md
  console.log('[Step 2] Parsing candidate PRs from triage table...');
  if (!fs.existsSync(TRIAGE_TABLE_PATH)) {
    console.error(`Triage table not found at: ${TRIAGE_TABLE_PATH}`);
    process.exit(1);
  }

  const { candidates, reason } = selectCleanCandidates(
    fs.readFileSync(TRIAGE_TABLE_PATH, 'utf8').split('\n')
  );

  // A table this tool cannot read is an error, not an empty backlog. Exiting 0 on one is how the
  // previous version of this selection went quiet for a whole schema change without anybody noticing.
  if (reason !== undefined) {
    console.error(`ERROR: ${reason}.`);
    process.exit(1);
  }
  if (candidates.length === 0) {
    console.log(
      `No PR is both CLEAN against origin/main and marked "${DRY_RUN_COLUMN}: yes". Exiting.`
    );
    process.exit(0);
  }

  console.log(`Found ${candidates.length} candidate PR(s): #${candidates.join(', #')}\n`);

  // Record initial branch
  const branchResult = runCommand('git branch --show-current');
  const originalBranch = branchResult.output || 'main';

  const todayStr = getTodayString();
  const evidenceDir = path.join(EVIDENCE_BASE_DIR, todayStr);
  if (!fs.existsSync(evidenceDir)) {
    fs.mkdirSync(evidenceDir, { recursive: true });
  }

  const summaryReportPath = path.join(evidenceDir, 'pr-dry-run-summary.md');
  let reportMarkdown = `# PR Dry-Run Summary (${todayStr})\n\n`;
  reportMarkdown += `Validated against original branch: \`${originalBranch}\`\n\n`;
  reportMarkdown += '| PR | Fetch Status | npm test | npm run verify | Final Result | Notes |\n';
  reportMarkdown += '| --- | --- | --- | --- | --- | --- |\n';

  // 3. Process each candidate
  console.log('[Step 3] Commencing dry-run loop...');
  for (const pr of candidates) {
    reportMarkdown += dryRunPr(pr, { evidenceDir, originalBranch });
  }

  // Write final report
  fs.writeFileSync(summaryReportPath, reportMarkdown);
  console.log(`\n==================================================`);
  console.log(`Dry-run validation complete.`);
  console.log(`Summary report written to: ${summaryReportPath}`);
  console.log(`==================================================`);
}

// Guarded so a test can import `selectCleanCandidates` without checking out pull requests and
// running the whole suite against each of them as a side effect of the suite.
if (isEntryPoint(import.meta.url)) {
  main().catch(console.error);
}
