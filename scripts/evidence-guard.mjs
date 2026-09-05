#!/usr/bin/env node
// Purpose: Refuse to let an evidence folder be trusted when a transcript in it does not carry its
//          own result — an empty run, a truncated capture, or two files disagreeing about the same
//          run.
// Why: Three separate times this repository shipped evidence that proved nothing and looked fine.
//      `verify-outer.txt` once stopped after the audit gate, with no exit line. `e2e.txt` carried an
//      empty Row 2 for several heads while three documents cited "41 passed" from it. Both were
//      found by a reviewer opening the file, which is the check that terminates — every other check
//      compared one claim against another claim.
// Info flow: docs/evidence/<date>/ -> this script -> exit 0, or a named failure and exit 1.
//
// Critical invariants:
//   1. Every rule here reads a COMMITTED artifact, never the scratch output of the command that
//      produced it. A capture pipeline can succeed and still write the wrong bytes; that gap is the
//      whole reason this exists.
//   2. No rule hardcodes a count. Counts move — the suite went 1407 -> 1445 and Playwright 38 -> 41
//      when a sibling branch merged, and every hardcoded copy of those numbers in the capture
//      tooling either broke silently or fired for the wrong reason. Rules here compare artifacts
//      against each other, or assert only that a result exists.
//   3. A rule that cannot be evaluated is a failure, not a skip. A missing file is the exact state
//      this script is for.

import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Colour codes out, without an escape character inside a regular expression. `no-control-regex`
 * rejects that, and the first version of this file was caught by the repository's own lint saying
 * so — the capture pipeline refused to go on, which is the pipeline working. Splitting on the escape
 * and trimming the sequence off each following piece needs no control character in a pattern.
 */
const ESC = String.fromCharCode(27);
const stripAnsi = (text) =>
	text
		.split(ESC)
		.map((part, index) => (index === 0 ? part : part.replace(/^\[[0-9;]*m/, '')))
		.join('');

/** The last `<n> passed` in a transcript, as a number, or null when the transcript has no result. */
const lastPassedCount = (text) => {
	const matches = stripAnsi(text).match(/(\d+) passed/g);
	if (!matches || matches.length === 0) return null;
	return Number(matches[matches.length - 1].split(' ')[0]);
};

const read = (dir, name) => {
	const path = join(dir, name);
	if (!existsSync(path)) return null;
	return readFileSync(path, 'utf8');
};

/**
 * Every rule, as data. Each returns `null` when it holds, or a sentence naming what is wrong —
 * phrased so the failure says what it means rather than which assertion tripped.
 */
const RULES = [
	{
		name: 'verify-outer.txt carries the chain exit status',
		check: (dir) => {
			const outer = read(dir, 'verify-outer.txt');
			if (outer === null) return 'verify-outer.txt is missing; the chain has no transcript.';
			if (!/verify exit=0/.test(outer))
				return 'verify-outer.txt does not contain "verify exit=0" — it was captured before the chain finished, or the chain failed.';
			const lines = outer.split('\n').length;
			if (lines <= 40)
				return `verify-outer.txt is only ${lines} lines; a complete chain transcript is far longer, so this one was truncated mid-write.`;
			return null;
		}
	},
	{
		name: 'verify-outer.txt and test.txt agree on the suite total',
		check: (dir) => {
			const outer = read(dir, 'verify-outer.txt');
			const inner = read(dir, 'test.txt');
			if (outer === null || inner === null)
				return 'verify-outer.txt and test.txt must both exist to be compared.';
			const outerTotal = lastPassedCount(outer);
			const innerTotal = lastPassedCount(inner);
			if (outerTotal === null) return 'verify-outer.txt reports no test total.';
			if (innerTotal === null) return 'test.txt reports no test total.';
			if (outerTotal !== innerTotal)
				return `verify-outer.txt reports ${outerTotal} passed and test.txt reports ${innerTotal}; they are two records of one run, so one of them is from a different head.`;
			return null;
		}
	},
	{
		name: 'e2e.txt carries a result, not just its own headings',
		check: (dir) => {
			const e2e = read(dir, 'e2e.txt');
			if (e2e === null) return null; // not every change runs the end-to-end suite
			if (lastPassedCount(e2e) === null)
				return 'e2e.txt has no "<n> passed" line; the transcript was spliced in against a header that did not match, so the file records a run that cannot be audited.';
			const lines = e2e.split('\n').length;
			if (lines <= 40)
				return `e2e.txt is only ${lines} lines; the per-test output is missing, so the summary cannot be checked against anything.`;
			return null;
		}
	},
	{
		name: 'every rewind transcript reports its contract tests',
		check: (dir) => {
			const rewinds = readdirSync(dir).filter((f) => f.startsWith('rewind-') && f.endsWith('.txt'));
			const empty = rewinds.filter((f) => lastPassedCount(read(dir, f) ?? '') === null);
			if (empty.length > 0)
				return `these rewind transcripts report no passing tests: ${empty.join(', ')}.`;
			return null;
		}
	}
];

const dir = process.argv[2] ?? latestEvidenceDir();

function latestEvidenceDir() {
	const root = 'docs/evidence';
	const dated = readdirSync(root)
		.filter((name) => /^\d{4}-\d{2}-\d{2}$/.test(name))
		.sort();
	if (dated.length === 0) {
		console.error('evidence-guard: no dated folder under docs/evidence.');
		process.exit(1);
	}
	return join(root, dated[dated.length - 1]);
}

if (!existsSync(dir)) {
	console.error(`evidence-guard: ${dir} does not exist.`);
	process.exit(1);
}

const failures = [];
for (const rule of RULES) {
	const problem = rule.check(dir);
	if (problem) failures.push(`  ${rule.name}:\n    ${problem}`);
}

if (failures.length > 0) {
	console.error(`evidence-guard: ${dir}\n`);
	console.error(failures.join('\n\n'));
	console.error(`\n${failures.length} of ${RULES.length} rules failed.`);
	process.exit(1);
}

console.log(`evidence-guard: ${dir} — all ${RULES.length} rules pass.`);
