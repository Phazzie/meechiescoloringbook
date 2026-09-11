/**
 * Purpose: Automate the check-out and verification of clean PR candidates from the triage table.
 * Why: Eliminate manual checking and verify pull requests against local tests programmatically.
 * Info flow: docs/triage-table.md -> validate-pr-backlog.js -> git / npm verify commands -> docs/evidence/YYYY-MM-DD/pr-dry-run-summary.md.
 */

import fs from 'node:fs';
import path from 'node:path';
import { STATUS_COLUMN, readTable, runCommand } from './analyze-merge-conflicts.js';
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

/**
 * Which PRs in the triage table are worth checking out and validating locally.
 *
 * Read from the `Merge status` column, by name, rather than by searching every line for the literal
 * `1. Safe candidate for dry-run`. That bucket vocabulary described a backlog triage that is over,
 * and the search was silent about its own obsolescence: once the table stopped using the phrase this
 * tool reported "No PR candidates found" and exited 0, which looks exactly like a clean backlog.
 *
 * `CLEAN` is the same claim the bucket made — the PR merges against origin/main, so it can be
 * checked out and run — but it is measured by `analyze-merge-conflicts.js` rather than typed.
 *
 * @param {string[]} lines
 * @returns {number[]}
 */
export const selectCleanCandidates = (lines) => {
  const table = readTable(lines);
  if (table === null) {
    return [];
  }
  return table.prRows
    .filter((row) => lines[row.lineIndex].split('|')[table.columns[STATUS_COLUMN]]?.trim() === 'CLEAN')
    .map((row) => row.pr);
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

  const candidates = selectCleanCandidates(
    fs.readFileSync(TRIAGE_TABLE_PATH, 'utf8').split('\n')
  );

  if (candidates.length === 0) {
    console.log('No PR in the triage table is currently CLEAN against origin/main. Exiting.');
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
