/**
 * Purpose: Analyze merge conflicts for all open candidate PRs against the current main branch in real-time.
 * Why: Identify exactly which files are conflicting for each PR to help developers plan conflict resolution.
 * Info flow: docs/triage-table.md (PR list) -> analyze-merge-conflicts.js -> git merge tests -> update docs/triage-table.md.
 */

import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const TRIAGE_TABLE_PATH = path.resolve('docs/triage-table.md');

function runCommand(command) {
  try {
    const stdout = execSync(command, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
    return { success: true, output: stdout.trim() };
  } catch (error) {
    return { success: false, output: (error.stdout || '') + '\n' + (error.stderr || '') + '\n' + error.message };
  }
}

async function main() {
  console.log('==================================================');
  console.log('PR Merge Conflict Analyzer');
  console.log('==================================================\n');

  // Verify git working tree is clean
  const statusResult = runCommand('git status --porcelain');
  const statusLines = statusResult.output.split('\n').filter(line => line.trim().length > 0 && !line.startsWith('??'));
  if (statusLines.length > 0) {
    console.error('ERROR: Your git working tree has uncommitted modifications. Please stash or commit them first.');
    process.exit(1);
  }

  if (!fs.existsSync(TRIAGE_TABLE_PATH)) {
    console.error(`Triage table not found at: ${TRIAGE_TABLE_PATH}`);
    process.exit(1);
  }

  // Parse PR list from table
  const tableContent = fs.readFileSync(TRIAGE_TABLE_PATH, 'utf8');
  const lines = tableContent.split('\n');
  const prRows = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const match = line.match(/^\|\s*#(\d+)\s*\|/);
    if (match) {
      prRows.push({
        pr: parseInt(match[1], 10),
        lineIndex: i,
        originalLine: line
      });
    }
  }

  if (prRows.length === 0) {
    console.log('No PR rows found in triage table.');
    process.exit(0);
  }

  console.log(`Analyzing merge status for ${prRows.length} PRs against current HEAD...`);

  const originalBranch = runCommand('git branch --show-current').output || 'main';

  // Process each PR
  for (const row of prRows) {
    const pr = row.pr;
    const tempBranch = `pr-${pr}-conflict-temp`;
    const testMergeBranch = `test-merge-${pr}-temp`;

    console.log(`Testing PR #${pr}...`);

    // Clean up past branches
    runCommand(`git branch -D ${tempBranch}`);
    runCommand(`git branch -D ${testMergeBranch}`);

    // Fetch PR
    const fetchResult = runCommand(`git fetch origin pull/${pr}/head:${tempBranch}`);
    if (!fetchResult.success) {
      console.warn(`[WARNING] Failed to fetch PR #${pr}. Skipping.`);
      continue;
    }

    // Checkout test merge branch from original branch
    const checkoutResult = runCommand(`git checkout -b ${testMergeBranch} ${originalBranch}`);
    if (!checkoutResult.success) {
      console.error(`[ERROR] Failed to checkout test branch for PR #${pr}.`);
      runCommand(`git branch -D ${tempBranch}`);
      continue;
    }

    // Attempt merge
    const mergeResult = runCommand(`git merge ${tempBranch} --no-commit --no-ff`);

    let isClean = true;
    let conflictFiles = [];

    if (!mergeResult.success) {
      isClean = false;
      // Get list of files with merge conflicts (Unmerged status)
      const diffResult = runCommand('git diff --name-only --diff-filter=U');
      conflictFiles = diffResult.output.split('\n').filter(f => f.trim().length > 0);

      // Abort the merge
      runCommand('git merge --abort');
    }

    // Go back and clean up
    runCommand(`git checkout ${originalBranch}`);
    runCommand(`git branch -D ${testMergeBranch}`);
    runCommand(`git branch -D ${tempBranch}`);

    // Update row details
    const statusText = isClean ? 'CLEAN' : 'CONFLICT';
    const notes = isClean
      ? 'Merges cleanly against origin/main.'
      : `Has conflicts: ${conflictFiles.join(', ')}.`;

    // Reconstruct the table line
    // Format: | #PR | Title | Author | Merge Status | Target Bucket | Concrete Reason |
    const parts = row.originalLine.split('|');
    parts[4] = ` ${statusText} `;

    // If it's currently marked as clean but has conflicts, demote the Target Bucket
    let targetBucket = parts[5].trim();
    if (!isClean && targetBucket.includes('1. Safe candidate')) {
      targetBucket = '**4. High-conflict/manual intervention**';
    } else if (isClean && targetBucket.includes('4. High-conflict')) {
      targetBucket = '**1. Safe candidate for dry-run**';
    }

    parts[5] = ` ${targetBucket} `;
    parts[6] = ` ${notes} `;

    lines[row.lineIndex] = parts.join('|');
    console.log(`-> PR #${pr} is ${statusText}.`);
  }

  // Save the updated table
  fs.writeFileSync(TRIAGE_TABLE_PATH, lines.join('\n'));
  console.log(`\n==================================================`);
  console.log(`Conflict analysis complete.`);
  console.log(`Updated triage table: ${TRIAGE_TABLE_PATH}`);
  console.log(`==================================================`);
}

main().catch(console.error);
