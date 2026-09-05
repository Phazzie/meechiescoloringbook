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

import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import process from 'node:process';
import { toDateFolder } from './evidence-reporting.mjs';

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
		.map((part, index) => (index === 0 ? part : part.replace(/^\[[0-9;]{0,16}m/, '')))
		.join('');

/**
 * A reporter's summary lines, and nothing else.
 *
 * Every rule that asks "did this run pass" or "did this run fail" goes through here. Both questions,
 * both reporters, one definition — because the alternative was tried: the failure pattern was
 * anchored while the pass pattern next to it was not, and the Row 2 rule was anchored while its twin
 * in the rewind rule was not. Prose in a test title then counted as a result, in both directions.
 *
 * A summary line begins the line (allowing the reporter's indent) and starts with a count or one of
 * the reporter's own labels. A sentence a developer wrote inside a test name cannot reach it.
 */
const summaryLines = (text) =>
	stripAnsi(text)
		.split('\n')
		.filter((line) => /^\s{0,8}(\d{1,9} \w|Tests\s|Test Files\s|Errors\s)/.test(line));

/** The last `<n> passed` in a transcript, as a number, or null when the transcript has no result. */
const lastPassedCount = (text) => {
	// Bounded rather than `\d+`: an unbounded quantifier before a literal backtracks, which
	// `sonarjs/super-linear-regex` flags and which is a real cost on a long transcript. No suite
	// reports a ten-digit total.
	const matches = summaryLines(text).join('\n').match(/(\d{1,9}) passed/g);
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
			// Markers that only stage OUTPUT produces. An earlier version looked for 'proof', which
			// appears in the echoed `npm run verify` command line at the top of the transcript — so a
			// transcript truncated right after the test summary, with an exit line appended, satisfied
			// it while none of the post-test stages had run. A marker that the header can supply is not
			// a marker. The stages after the tests print nothing distinctive, so they are proved from
			// their artifacts below rather than from this file.
			const STAGE_MARKERS = [
				{ marker: 'svelte-check found', stage: 'the check stage' },
				{ marker: 'Test Files', stage: 'the test stage' }
			];
			const missing = STAGE_MARKERS.filter(({ marker }) => !outer.includes(marker));
			if (missing.length > 0)
				return `verify-outer.txt is missing ${missing.map((m) => m.stage).join(', ')}; it carries an exit line but not the run that earned it.`;
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
			// Totals alone do not identify a run. Two heads with the same suite size produce the same
			// number, so a stale test.txt satisfied this rule while reporting a different start time
			// than the transcript that supposedly contains it. The runner stamps both files with the
			// same start and duration, which is what makes them one run rather than two that agree.
			const identity = (text) => {
				const clean = stripAnsi(text);
				const startedAt = /Start at\s+([0-9:]{1,8})/.exec(clean)?.[1];
				const duration = /Duration\s+([0-9.]{1,12}s)/.exec(clean)?.[1];
				return startedAt && duration ? `${startedAt} / ${duration}` : null;
			};
			const outerRun = identity(outer);
			const innerRun = identity(inner);
			if (outerRun === null || innerRun === null)
				return 'verify-outer.txt or test.txt carries no run start and duration, so the two cannot be shown to be the same run rather than two that happen to agree.';
			if (outerRun !== innerRun)
				return `verify-outer.txt records the run at ${outerRun} and test.txt at ${innerRun}; they report the same total but are different runs, so one is from an earlier head.`;
			return null;
		}
	},
	{
		name: 'the chain stages after the tests actually ran',
		check: (dir) => {
			// The transcript cannot show this: shaolin-lint, seam-ledger, clan-chain and proof-tape
			// print nothing distinctive. Their stamps can. chamber-lock is written near the start of
			// the chain and the proof tape at the end, so the tape being no older than the lock is
			// evidence the chain reached its last stage — and it survives a clone and a squash, which a
			// file's modification time does not.
			const readStamp = (name) => {
				const raw = read(dir, name);
				if (raw === null) return null;
				try {
					const at = JSON.parse(raw).generatedAt;
					return typeof at === 'string' ? Date.parse(at) : null;
				} catch {
					return null;
				}
			};
			const lock = readStamp('chamber-lock.json');
			const tape = readStamp('proof-tape.json');
			// Every stage, not just the two the timestamps bracket. Removing an intermediate artifact
			// and re-running proof:tape alone leaves the tape newer than the lock, so boundary stamps
			// cannot show the middle of the chain ran — they only show something ran first and last.
			const CHAIN_ARTIFACTS = [
				'chamber-lock.json',
				'verify.txt',
				'test.txt',
				'shaolin-lint.json',
				'assumption-alarm.json',
				'seam-ledger.json',
				'clan-chain.json',
				'proof-tape.json'
			];
			const inventory = [];
			const collect = (node) => {
				if (Array.isArray(node)) return node.forEach(collect);
				if (node === null || typeof node !== 'object') return;
				if (typeof node.name === 'string' && typeof node.sizeBytes === 'number')
					inventory.push({ name: node.name, sizeBytes: node.sizeBytes, predatesRun: node.predatesRun });
				Object.values(node).forEach(collect);
			};
			collect(JSON.parse(read(dir, 'proof-tape.json') ?? '{}'));
			const absent = CHAIN_ARTIFACTS.filter((name) => read(dir, name) === null);
			if (absent.length > 0)
				return `these chain stages left no artifact: ${absent.join(', ')}; the chain did not run all of them.`;
			// Present is not current. A run that stops invoking an intermediate stage leaves the previous
			// artifact in place, and the tape then flags it as predating this run while everything else
			// looks finished. The tape already computes that; nothing was reading it.
			const stale = CHAIN_ARTIFACTS.filter((name) =>
				inventory.some((entry) => entry.name === name && entry.predatesRun === true)
			);
			if (stale.length > 0)
				return `the proof tape marks these chain artifacts as predating its own run: ${stale.join(', ')}; that stage did not run this time.`;
			if (lock === null) return 'chamber-lock.json is missing or carries no generatedAt stamp.';
			if (tape === null) return 'proof-tape.json is missing or carries no generatedAt stamp.';
			if (Number.isNaN(lock) || Number.isNaN(tape))
				return 'a chain artifact carries a generatedAt that is not a date.';
			if (tape < lock)
				return `proof-tape.json is stamped before chamber-lock.json (${new Date(tape).toISOString()} < ${new Date(lock).toISOString()}); the tape is from an earlier run than the chain that was supposed to write it.`;
			// The stamps prove the chain finished. They do not prove it finished over THESE bytes: an
			// artifact edited after the tape was written leaves the tape newer than the lock and
			// describing a different file. That exact mismatch shipped once — the tape recorded 1233
			// bytes for a 6677-byte e2e.txt — and was found by a reviewer, not by anything here.

			// verify-outer.txt is the one artifact written AFTER the chain, by design — the transcript
			// of the run that writes the tape cannot be inventoried by it. docs/evidence/README.md says
			// so, and I wrote that section. The tape nonetheless lists the PREVIOUS run's copy, so
			// comparing it here rejects correctly captured evidence the moment the transcript's length
			// changes between runs. It passes today only because both copies happen to be 4438 bytes.
			// Its freshness is rule 1's job, which reads its contents rather than its size.
			const POST_TAPE = new Set(['verify-outer.txt']);
			const drifted = inventory
				.filter(({ name }) => !POST_TAPE.has(name))
				.map(({ name, sizeBytes }) => {
					const path = join(dir, name);
					if (!existsSync(path)) return `${name} is inventoried but not present`;
					const actual = statSync(path).size;
					return actual === sizeBytes ? null : `${name} is inventoried at ${sizeBytes} bytes and is ${actual}`;
				})
				.filter((entry) => entry !== null);
			if (drifted.length > 0)
				return `the proof tape describes files that are not the ones committed: ${drifted.join('; ')}.`;
			return null;
		}
	},
	{
		name: 'e2e.txt Row 2 carries its own result',
		check: (dir) => {
			const e2e = read(dir, 'e2e.txt');
			if (e2e === null) return null; // not every change runs the end-to-end suite
			const marker = e2e.indexOf('## Row 2');
			if (marker === -1)
				return 'e2e.txt has no "## Row 2" section; the mandated command and the run that actually executes are both meant to be recorded.';
			// Scoped to Row 2 on purpose. Reading the whole file lets Row 1 mask an empty Row 2 —
			// the mandated command can execute partially and print its own "1 passed" before failing,
			// and the splice failure this rule exists to catch would then pass. Row 2 is the row whose
			// result gets cited, so Row 2 is what gets checked.
			const row2 = e2e.slice(marker);
			if (lastPassedCount(row2) === null)
				return 'e2e.txt Row 2 has no "<n> passed" line; the transcript was spliced in against a header that did not match, so the run it records cannot be audited.';
			if (!/\.spec\.[tj]s/.test(row2))
				return 'e2e.txt Row 2 has a summary but no per-test lines; the summary cannot be checked against anything.';
			// A passing count is not a passing run. Playwright prints "<n> passed" alongside "<n> failed"
			// when both happen, so a row with one pass and forty failures satisfied every check above.
			// "error" is in here because Playwright's list reporter prints "<n> passed" beside
			// "1 error was not a part of any test" when something fails outside a test body — a green
			// count next to a red run, which is the shape this rule keeps being caught by.
			// Anchored to the reporter's own summary lines. Scanning the whole transcript meant a
			// passing test *titled* "shows 1 error message accessibly" failed the rule — valid evidence
			// rejected because a human sentence contained a number and a word.
			const broken = summaryLines(row2)
				.map((line) => /^\s{0,8}(\d{1,9}) (failed|flaky|did not run|interrupted|errors?)\b/.exec(line))
				.find((match) => match !== null && match !== undefined);
			if (broken !== undefined)
				return `e2e.txt Row 2 reports "${broken[0].trim()}"; a summary line that also counts passes does not make the run green.`;
			return null;
		}
	},
	{
		name: 'every rewind transcript reports contract tests, and none of them failing',
		check: (dir) => {
			const rewinds = readdirSync(dir).filter((f) => f.startsWith('rewind-') && f.endsWith('.txt'));
			// The `Tests` summary specifically. `lastPassedCount` also matches "Test Files 1 passed", so
			// a transcript truncated after that line — before any contract test result — counted as a
			// pass. A file count is not a test count.
			const TESTS_SUMMARY = /^\s{0,8}Tests\s+\d{1,9} passed/m;
			const empty = rewinds.filter((f) => !TESTS_SUMMARY.test(stripAnsi(read(dir, f) ?? '')));
			if (empty.length > 0)
				return `these rewind transcripts carry no "Tests <n> passed" summary: ${empty.join(', ')}.`;
			// A seam run that reports "1 failed | 16 passed" has a passing count and is not a pass.
			// Same shape as the end-to-end rule above, and it was missing here for the same reason:
			// the rule asked whether a number was present rather than what the numbers said.
			// Vitest can exit 1 while reporting "Tests 1 passed" and "Errors 1 error" / "Vitest caught
			// 1 unhandled error" — a failure outside any test body, which is the same shape as
			// Playwright's "1 error was not a part of any test" and was missed here for the same reason:
			// the pattern was written from the failures I had seen rather than from how the reporter
			// says a run went wrong.
			const FAILING = /^\s{0,8}(Tests|Errors)?\s{0,8}(\d{1,9}) (failed|errors?)\b|^\s{0,8}Vitest caught \d{1,9} unhandled error/;
			const failing = rewinds.filter((f) =>
				summaryLines(read(dir, f) ?? '').some((line) => FAILING.test(line))
			);
			if (failing.length > 0)
				return `these rewind transcripts report failures beside their passes: ${failing.join(', ')}.`;
			return null;
		}
	},
	{
		name: 'the routine\'s lint and build evidence is present and green',
		check: (dir) => {
			// AGENTS.md requires check, lint, test and build before every push. The chain covers check
			// and test; lint and build are captured by hand beside it, so nothing was reading them and
			// both could be absent or red while every other rule passed.
			const REQUIRED = [
				{ file: 'lint.txt', ok: /lint exit=0/, ran: 'npm run lint' },
				{ file: 'build.txt', ok: /build exit=0/, ran: 'npm run build' }
			];
			for (const { file, ok, ran } of REQUIRED) {
				const text = read(dir, file);
				// Absence is not judged here. `npm run verify` writes neither of these, so an ordinary
				// seam change's folder legitimately has no lint.txt — and requiring one turned CI red on
				// compliant evidence. Requiring them for the scheduled routines that DO mandate them means
				// classifying the change, which is the policy-engine work declined in round 32 and
				// recorded as follow-up. What is here must be green; what is absent is somebody else's rule.
				if (text === null) continue;
				if (!ok.test(stripAnsi(text)))
					return `${file} does not record a successful exit; ${ran} either failed or was captured without its result.`;
			}
			return null;
		}
	}
];

const dir = process.argv[2] ?? join('docs/evidence', toDateFolder(new Date()));

if (!existsSync(dir)) {
	// Today's folder, not the newest that happens to exist. Selecting the latest dated directory
	// meant that a run whose evidence was never written — because the chain stopped at the audit
	// gate, say — validated the PREVIOUS run's folder and printed that every rule passed. A guard
	// that reports success for a run that produced nothing is worse than no guard.
	console.error(`evidence-guard: ${dir} does not exist.`);
	console.error(
		'  This run has written no evidence folder for today. Pass a directory explicitly to check an\n' +
			'  older one; the default is deliberately not "whichever is newest".'
	);
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
