/**
 * Purpose: Automate the check-out and verification of clean PR candidates from the triage table.
 * Why: Eliminate manual checking and verify pull requests against local tests programmatically.
 * Info flow: docs/triage-table.md -> validate-pr-backlog.js -> git / npm verify commands -> docs/evidence/YYYY-MM-DD/pr-dry-run-summary.md.
 */

import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

// Configuration
const TRIAGE_TABLE_PATH = path.resolve('docs/triage-table.md');
const EVIDENCE_BASE_DIR = path.resolve('docs/evidence');

function runCommand(command) {
  try {
    const stdout = execSync(command, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
    return { success: true, output: stdout.trim() };
  } catch (error) {
    return { success: false, output: (error.stdout || '') + '\n' + (error.stderr || '') + '\n' + error.message };
  }
}

function getTodayString() {
  const date = new Date();
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

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

  const tableContent = fs.readFileSync(TRIAGE_TABLE_PATH, 'utf8');
  const lines = tableContent.split('\n');
  const candidates = [];

  for (const line of lines) {
    if (line.includes('1. Safe candidate for dry-run')) {
      const match = line.match(/\|\s*#(\d+)\s*\|/);
      if (match) {
        candidates.push(parseInt(match[1], 10));
      }
    }
  }

  if (candidates.length === 0) {
    console.log('No PR candidates found in "1. Safe candidate for dry-run" bucket. Exiting.');
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
    console.log(`\n--------------------------------------------------`);
    console.log(`PR #${pr}: Fetching and checking out...`);
    console.log(`--------------------------------------------------`);

    const tempBranch = `pr-${pr}-dryrun-temp`;
    
    // Clean up if temp branch exists from a past run
    runCommand(`git branch -D ${tempBranch}`);

    // Fetch and create temp branch
    const fetchCmd = `git fetch origin pull/${pr}/head:${tempBranch}`;
    const fetchResult = runCommand(fetchCmd);
    
    if (!fetchResult.success) {
      console.error(`[FAIL] Fetch failed for PR #${pr}.`);
      reportMarkdown += `| #${pr} | ❌ Fetch Failed | - | - | ❌ FAILED | Fetch output: ${fetchResult.output.replace(/\n/g, '<br>')} |\n`;
      continue;
    }

    // Checkout
    const checkoutResult = runCommand(`git checkout ${tempBranch}`);
    if (!checkoutResult.success) {
      console.error(`[FAIL] Checkout failed for PR #${pr}.`);
      reportMarkdown += `| #${pr} | ❌ Checkout Failed | - | - | ❌ FAILED | Checkout output: ${checkoutResult.output.replace(/\n/g, '<br>')} |\n`;
      runCommand(`git branch -D ${tempBranch}`);
      continue;
    }

    console.log(`PR #${pr}: Running npm test...`);
    const testResult = runCommand('npm test');
    const testStatus = testResult.success ? '✅ PASS' : '❌ FAIL';

    console.log(`PR #${pr}: Running npm run verify...`);
    const verifyResult = runCommand('npm run verify');
    const verifyStatus = verifyResult.success ? '✅ PASS' : '❌ FAIL';

    const finalResult = (testResult.success && verifyResult.success) ? '✅ VERIFIED' : '❌ FAILED';
    
    if (testResult.success && verifyResult.success) {
      console.log(`[PASS] PR #${pr} passed all validation tests!`);
    } else {
      console.error(`[FAIL] PR #${pr} failed validation tests.`);
    }

    // Capture logs if failed
    let notes = '';
    if (!testResult.success) {
      notes += 'Test failures logged. ';
      fs.writeFileSync(path.join(evidenceDir, `pr-${pr}-npm-test-fail.log`), testResult.output);
    }
    if (!verifyResult.success) {
      notes += 'Verify checks failed. ';
      fs.writeFileSync(path.join(evidenceDir, `pr-${pr}-npm-verify-fail.log`), verifyResult.output);
    }
    if (testResult.success && verifyResult.success) {
      notes = 'All checks green. Ready to merge.';
    }

    reportMarkdown += `| #${pr} | ✅ Success | ${testStatus} | ${verifyStatus} | **${finalResult}** | ${notes} |\n`;

    // Reset and clean up
    console.log(`PR #${pr}: Cleaning up...`);
    runCommand(`git checkout ${originalBranch}`);
    runCommand(`git branch -D ${tempBranch}`);
  }

  // Write final report
  fs.writeFileSync(summaryReportPath, reportMarkdown);
  console.log(`\n==================================================`);
  console.log(`Dry-run validation complete.`);
  console.log(`Summary report written to: ${summaryReportPath}`);
  console.log(`==================================================`);
}

main().catch(console.error);
