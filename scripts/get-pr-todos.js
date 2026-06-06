/**
 * Purpose: Extract and scope review comments for a specific PR from the massive tracking ledger.
 * Why: Help agents and developers focus on resolving comments for one PR at a time without scanning 6000+ lines.
 * Info flow: docs/todo-from-cleanup.md -> get-pr-todos.js -> console output / docs/evidence/YYYY-MM-DD/pr-XX-todo.md.
 */

import fs from 'node:fs';
import path from 'node:path';

const LEDGER_PATH = path.resolve('docs/todo-from-cleanup.md');
const EVIDENCE_BASE_DIR = path.resolve('docs/evidence');

function getTodayString() {
  const date = new Date();
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function main() {
  const prNumber = process.argv[2];
  if (!prNumber || isNaN(parseInt(prNumber, 10))) {
    console.error('Usage: node scripts/get-pr-todos.js <PR_NUMBER>');
    process.exit(1);
  }

  console.log(`==================================================`);
  console.log(`PR Review Comment Extractor for PR #${prNumber}`);
  console.log(`==================================================\n`);

  if (!fs.existsSync(LEDGER_PATH)) {
    console.error(`Ledger file not found at: ${LEDGER_PATH}`);
    process.exit(1);
  }

  const ledgerContent = fs.readFileSync(LEDGER_PATH, 'utf8');
  const lines = ledgerContent.split('\n');

  let inTargetPrSection = false;
  let prSectionContent = [];
  const targetHeaderPattern = new RegExp(`^### \\[#${prNumber}\\]`);

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (targetHeaderPattern.test(line)) {
      inTargetPrSection = true;
      prSectionContent.push(line);
      continue;
    }

    if (inTargetPrSection) {
      // If we hit another PR section, we stop parsing
      if (line.startsWith('### [#') && !targetHeaderPattern.test(line)) {
        break;
      }
      prSectionContent.push(line);
    }
  }

  if (prSectionContent.length === 0) {
    console.log(`No unresolved review threads found for PR #${prNumber} in ${LEDGER_PATH}.`);
    process.exit(0);
  }

  const resultText = prSectionContent.join('\n');
  console.log(resultText);

  // Write to evidence folder
  const todayStr = getTodayString();
  const evidenceDir = path.join(EVIDENCE_BASE_DIR, todayStr);
  if (!fs.existsSync(evidenceDir)) {
    fs.mkdirSync(evidenceDir, { recursive: true });
  }

  const outputPath = path.join(evidenceDir, `pr-${prNumber}-todo.md`);
  fs.writeFileSync(outputPath, resultText);
  
  console.log(`\n==================================================`);
  console.log(`Scoped todo file written to: ${outputPath}`);
  console.log(`==================================================`);
}

main();
