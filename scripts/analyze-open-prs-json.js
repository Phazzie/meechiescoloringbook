import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const OPEN_PRS_PATH = path.resolve('open_prs_utf8.json');

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
  console.log('Open PRs Fast Bulk Merge Analyzer (PRs #149 - #226)');
  console.log('==================================================\n');

  if (!fs.existsSync(OPEN_PRS_PATH)) {
    console.error(`File not found: ${OPEN_PRS_PATH}`);
    process.exit(1);
  }

  const openPrs = JSON.parse(fs.readFileSync(OPEN_PRS_PATH, 'utf8'));
  console.log(`Bulk fetching pull refs from origin...`);
  const fetchRes = runCommand('git fetch origin "+refs/pull/*/head:refs/remotes/origin/pr/*"');
  if (!fetchRes.success) {
    console.warn(`Bulk fetch warning: ${fetchRes.output}`);
  }

  console.log(`Analyzing ${openPrs.length} PRs against current HEAD...\n`);

  const originalBranch = runCommand('git branch --show-current').output || 'main';
  const cleanPrs = [];
  const conflictPrs = [];
  const missingRefPrs = [];

  for (const prObj of openPrs) {
    const pr = prObj.number;
    const prRef = `origin/pr/${pr}`;
    const testMergeBranch = `test-merge-json-${pr}-temp`;

    // Check if ref exists
    const checkRef = runCommand(`git rev-parse --verify ${prRef}`);
    if (!checkRef.success) {
      console.warn(`[WARNING] Ref ${prRef} missing. Skipping.`);
      missingRefPrs.push(pr);
      continue;
    }

    // Checkout test merge branch from original branch
    const checkoutResult = runCommand(`git checkout -b ${testMergeBranch} ${originalBranch}`);
    if (!checkoutResult.success) {
      console.error(`[ERROR] Failed checkout for PR #${pr}.`);
      missingRefPrs.push(pr);
      continue;
    }

    // Attempt merge
    const mergeResult = runCommand(`git merge ${prRef} --no-commit --no-ff`);

    if (mergeResult.success) {
      console.log(`✅ PR #${pr} (${prObj.title}) merges CLEANLY.`);
      cleanPrs.push({
        pr,
        title: prObj.title,
        user: prObj.user,
        created_at: prObj.created_at,
        branch: prObj.branch
      });
      runCommand('git merge --abort');
    } else {
      const diffResult = runCommand('git diff --name-only --diff-filter=U');
      const conflictFiles = diffResult.output.split('\n').filter(f => f.trim().length > 0);
      console.log(`❌ PR #${pr} HAS CONFLICTS: ${conflictFiles.join(', ')}`);
      conflictPrs.push({
        pr,
        title: prObj.title,
        conflictFiles
      });
      runCommand('git merge --abort');
    }

    // Clean up branch
    runCommand(`git checkout ${originalBranch}`);
    runCommand(`git branch -D ${testMergeBranch}`);
  }

  console.log('\n==================================================');
  console.log('SUMMARY OF OPEN PRS (149-226)');
  console.log('==================================================');
  console.log(`Total Tested: ${openPrs.length}`);
  console.log(`Clean Merges: ${cleanPrs.length}`);
  console.log(`Conflicts: ${conflictPrs.length}`);
  console.log(`Missing Refs: ${missingRefPrs.length}\n`);

  console.log('CLEAN PR CANDIDATES:');
  cleanPrs.forEach(cp => {
    console.log(`- #${cp.pr}: ${cp.title} (@${cp.user})`);
  });

  fs.writeFileSync('open_prs_analysis.json', JSON.stringify({ cleanPrs, conflictPrs, missingRefPrs }, null, 2));
}

main().catch(console.error);
