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
import { join, basename, resolve, isAbsolute } from 'node:path';
import process from 'node:process';
import { toDateFolder } from './evidence-reporting.mjs';

/**
 * Colour codes out, without an escape character inside a regular expression. `no-control-regex`
 * rejects that, and the first version of this file was caught by the repository's own lint saying
 * so — the capture pipeline refused to go on, which is the pipeline working. Splitting on the escape
 * and trimming the sequence off each following piece needs no control character in a pattern.
 */
/** Where dated evidence folders live, as the proof tape records them. */
const EVIDENCE_ROOT = 'docs/evidence';

const ESC = String.fromCharCode(27);
const stripAnsi = (text) =>
	text
		// CRLF first. A transcript captured on Windows ends its lines `\r\n`, and every rule here
		// splits on `\n` and compares whole lines, so the stray `\r` made a terminal `verify exit=0`
		// unequal to itself and the guard rejected valid evidence. Same family as the backslash in
		// `evidenceDir`: this script kept assuming the machine that wrote the evidence was this one.
		.replace(/\r\n/g, '\n')
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
 * A summary line begins the line (allowing the reporter's indent) and is either a count followed by
 * one of the reporter's own status words, or one of its labels. A sentence a developer wrote inside
 * a test name cannot reach it.
 *
 * The count branch names the statuses rather than accepting `\d+ \w`. Anchoring alone was not
 * enough: a test that prints its own progress puts an unindented `1 passed` on stdout, the
 * transcript interleaves it with the reporter's, and a truncated run then carried a result it had
 * not earned. A closed vocabulary is narrower, and the exit status that rule 4 now requires is
 * narrower still — this filter decides which lines are summaries, not whether a run went well.
 *
 * `Vitest caught` is a label because it is a summary that begins with neither. Routing every rule
 * through this filter without it silently dropped the unhandled-error line the rewind rule had just
 * been taught to catch — a gate added to stop prose getting in, which also stopped a result getting
 * in.
 */
const BARE_COUNT_SUMMARY =
	/^\s{0,8}\d{1,9} (passed|failed|flaky|skipped|interrupted|did not run|errors?)\b/;
const LABELLED_SUMMARY = /^\s{0,8}(Tests|Test Files|Errors|Vitest caught)\s/;
const summaryLines = (text) =>
	stripAnsi(text)
		.split('\n')
		.filter((line) => BARE_COUNT_SUMMARY.test(line) || LABELLED_SUMMARY.test(line));

/**
 * The exit status a transcript records for one named command, or a sentence saying why it cannot be
 * read as one. `null` means the transcript is fine.
 *
 * One definition for every `<name> exit=<code>` line in this folder, because the alternative was
 * tried twice and failed twice. `/verify exit=0/.test(text)` asks whether a success appears
 * ANYWHERE, so a transcript appended to during a retry inherits the earlier run's pass: a capture
 * ending `verify exit=1` beneath an older `verify exit=0` satisfied it. That was reported against
 * `e2e exit=0`, I fixed that one instance, and left the identical bug in `verify`, `lint` and
 * `build` — three of which one reviewer then found, and two of which nobody had.
 *
 * Exactly one status, on its own line, equal to zero. Two statuses is itself the finding: one run
 * reports one status, so a second means the file was appended to rather than replaced and it no
 * longer says which run it describes.
 */
const EXIT_LINE = /^([a-z][a-z0-9-]{0,32}) exit=(\d{1,3})$/gm;

/**
 * The one terminal status a transcript records for `name`, as `{ code, line }`, or `{ problem }`
 * when it does not record exactly one that terminates the file.
 *
 * The two are separated because the waiver path needs to tell them apart. `exitStatusProblem` folds
 * a non-zero code into "this failed", which is right for a command that must pass — but Row 1's
 * command is ALLOWED to fail under a waiver, and the first version of that branch reached the waiver
 * whenever any problem was reported. A row with two statuses, or a truncated retry after an old one,
 * is not a failing run to be waived; it is a row that does not say what happened, which no waiver
 * covers.
 */
const terminalExitStatus = (text, name) => {
	const found = [...stripAnsi(text).matchAll(EXIT_LINE)].filter(([, who]) => who === name);
	if (found.length === 0) return { problem: `carries no "${name} exit=<code>" line of its own` };
	if (found.length > 1)
		return {
			problem: `carries ${found.length} "${name} exit=" lines (${found.map(([line]) => line).join(', ')}); one run reports one status, so this was appended to rather than replaced and it no longer says which run it describes`
		};
	const lines = stripAnsi(text)
		.split('\n')
		.filter((line) => line.trim() !== '');
	const last = lines[lines.length - 1];
	if (last !== found[0][0])
		return {
			problem: `records "${found[0][0]}" but does not end there — "${last.trim().slice(0, 70)}" follows it, so a later run was captured over it without recording a status of its own`
		};
	return { code: found[0][2], line: found[0][0] };
};

const exitStatusProblem = (text, name) => {
	const status = terminalExitStatus(text, name);
	if (status.problem !== undefined) return status.problem;
	if (status.code !== '0') return `reports "${status.line}", so that run failed`;
	return null;
};

/** The last `<n> passed` in a transcript, as a number, or null when the transcript has no result. */
const lastPassedCount = (text) => {
	// Bounded rather than `\d+`: an unbounded quantifier before a literal backtracks, which
	// `sonarjs/super-linear-regex` flags and which is a real cost on a long transcript. No suite
	// reports a ten-digit total.
	const matches = summaryLines(text).join('\n').match(/(\d{1,9}) passed/g);
	if (!matches || matches.length === 0) return null;
	const total = Number(matches[matches.length - 1].split(' ')[0]);
	// Zero passing tests is not a result. Vitest's `--passWithNoTests` and Playwright's
	// `--pass-with-no-tests` both exit 0 when discovery finds nothing, so a change that switched test
	// discovery off would have shipped `0 passed` with an exit status of zero beneath it and been
	// certified. Callers reject `null`, so reporting a total of none as "no total" is what makes them
	// reject it — the number is real, and it is not evidence that anything ran.
	return total > 0 ? total : null;
};

const read = (dir, name) => {
	const path = join(dir, name);
	if (!existsSync(path)) return null;
	return readFileSync(path, 'utf8');
};

/**
 * Whether a transcript's reporter summaries report any failure, as a sentence, or `null`.
 *
 * `Test Files` is in the labels because Vitest reports an afterAll failure as `Test Files 1 failed`
 * beside `Tests 1 passed`. Two patterns rather than one alternation: the combined form measured 21
 * against Sonar's regex-complexity limit of 20, and they are two different questions — a counted
 * failure, and a crash the reporter attributes to no test.
 *
 * Used by the chain transcript, `test.txt` and every rewind. It lived inline in the rewind rule
 * while the other two checked only that a marker was PRESENT, so a chain whose own script masked a
 * failure — `|| true` in a branch-owned `check` or `test` — exited zero with a red transcript and
 * every rule passed.
 */
// Anywhere in the line, not anchored after the label. The anchored form caught
// `Tests 1 failed | 16 passed` and missed `Tests 1445 passed | 1 failed`, because it required the
// FIRST count after the label to be the failing one — so whether a red run was detected depended on
// which order the reporter happened to print its counts in. `summaryLines` has already established
// that this is a reporter summary; within one, a count of failures is a count of failures wherever
// it sits.
// The COUNT, not just its presence. A reporter that spells out its zeroes — `1445 passed | 0
// failed` — was read as a failure, which would reject a perfectly green run for being explicit.
const COUNTED_FAILURE = /\b(\d{1,9}) (failed|errors?)\b/;
const UNHANDLED = /^\s{0,8}Vitest caught \d{1,9} unhandled error/;
const reportedFailure = (text) => {
	for (const line of summaryLines(text)) {
		const counted = COUNTED_FAILURE.exec(line);
		if ((counted !== null && Number(counted[1]) > 0) || UNHANDLED.test(line)) return line.trim();
	}
	return null;
};

/**
 * A `YYYY-MM-DD` string that names a real calendar day, or `null`.
 *
 * The shape check alone accepted `9999-99-99`, which string-compares later than every real date and
 * so granted a permanent waiver while naming no day at all. A pattern that matches the shape of a
 * date is not a date.
 */
const asCalendarDate = (value) => {
	const parsed = new Date(`${value}T00:00:00Z`);
	if (Number.isNaN(parsed.getTime())) return null;
	return toDateFolder(parsed) === value ? value : null;
};

/**
 * What is wrong with `e2e.txt`'s Row 1 — the MANDATED `npx playwright test` — or `null`.
 *
 * The rule used to slice straight to Row 2 and never read this row at all, so a run whose mandated
 * command failed outright passed the gate because the override beside it succeeded. An override is
 * a substitute for a browser, not for a requirement.
 *
 * `docs/evidence/README.md` provides the only honest way through when a mandated command genuinely
 * cannot run here: record the reason and a waiver expiry. So a red row is allowed exactly when it
 * says why, and only until the date it named. That is this run's own rule — a gate you cannot meet
 * is reported as unmet — turned into something a machine refuses to forget.
 */
const mandatedRowProblem = (row1) => {
	const status = terminalExitStatus(row1, 'e2e-mandated');
	// An ill-formed status is never waivable. A waiver excuses a command that FAILED; it cannot
	// excuse a row that does not say what the command did.
	if (status.problem !== undefined)
		return `${status.problem}; the mandated command's own result is what this row is for, and no waiver covers a row that does not state it.`;
	if (status.code === '0') {
		// A zero status and a red summary is a contradiction, and the row was accepted on the status
		// alone. `41 failed` above `e2e-mandated exit=0` passed every rule: a command whose result was
		// captured from the wrong place, or masked by a `|| true`, looks exactly like this. The status
		// answers "did it fail"; the summary answers "did anything in it fail", and a mandated run
		// needs both to agree.
		const contradicted = reportedFailure(row1);
		if (contradicted !== null)
			return `records a successful mandated command whose own summary reports failures ("${contradicted}"); a zero exit status beside a red summary means the status did not come from the run it claims to describe.`;
		// A status and nothing else is not a run. Deleting every line of the mandated command's output
		// and leaving `e2e-mandated exit=0` behind satisfied "no failure reported", because a row with
		// no summary reports nothing at all — the same "absence reads as success" that this file has
		// now been caught by five times.
		if (lastPassedCount(row1) === null)
			return 'records a successful mandated command with no passing result beneath it; a status says how a command ended and the summary says what it did, and a row with only the first is a claim with nothing under it.';
		return null;
	}
	const stated = /^Waiver-Expires: (\d{4}-\d{2}-\d{2})$/m.exec(row1)?.[1];
	if (stated === undefined || !/^Waiver-Reason: \S/m.test(row1))
		return 'records a failing mandated command with no waiver; a gate that cannot be met is reported as unmet, with a reason and an expiry, not passed over.';
	const expiry = asCalendarDate(stated);
	if (expiry === null)
		return `carries the waiver expiry "${stated}", which is not a real date; a value shaped like a date compares later than every real one, which is a permanent exception wearing a deadline.`;
	if (expiry < toDateFolder(new Date()))
		return `carries a waiver that expired on ${expiry}; the mandated command has been failing longer than the exception granted for it.`;
	return null;
};

/**
 * Whether one chain artifact agrees with itself: it reports `overallStatus: ok`, and every count in
 * its summary matches the list that summary describes.
 *
 * Byte counts are not identity. The drift check compares each artifact's length to the length the
 * tape recorded, and a same-length edit is invisible to it — changing one seam's status from "ok" to
 * "no" keeps the file exactly as long. These artifacts carry a summary AND the detail it summarises,
 * so they can be asked whether the two still agree; editing a status without also editing the count
 * that describes it breaks that agreement. Which is this whole run's defect, one last time, inside
 * the artifacts themselves.
 */
const selfAgreementProblem = (raw, file, list) => {
	if (raw === null) return `${file} is missing; it is a mandatory chain artifact.`;
	let parsed;
	try {
		parsed = JSON.parse(raw);
	} catch {
		return `${file} is not readable as JSON, so what it reports cannot be established.`;
	}
	const summary = parsed.summary;
	if (summary === null || typeof summary !== 'object')
		return `${file} carries no summary, so it states no overall result.`;
	if (summary.overallStatus !== 'ok')
		return `${file} reports overallStatus "${summary.overallStatus}"; a chain artifact that did not come back ok is not evidence of a passing run.`;
	// The headline is a claim about the columns beneath it. Moving one seam to `missing` and setting
	// the counters to 37/1 left `overallStatus: ok` standing over an artifact that says a required
	// seam artifact is missing, and every count matched its entries — the agreement rule cannot see a
	// headline that never disagreed with anything, because nothing was comparing them.
	const failures = Object.entries(summary)
		.filter(([status, value]) => typeof value === 'number' && status !== 'ok' && value > 0)
		.map(([status, value]) => `${value} ${status}`);
	if (failures.length > 0)
		return `${file} reports overallStatus "ok" while its own summary counts ${failures.join(', ')}; the headline is a claim about the columns beneath it.`;
	const entries = Array.isArray(parsed[list]) ? parsed[list] : null;
	if (entries === null)
		return `${file} has no "${list}" list, so its summary cannot be checked against anything.`;
	const counts = Object.entries(summary).filter(([, value]) => typeof value === 'number');
	const disagreements = counts
		.map(([status, claimed]) => {
			const actual = entries.filter((entry) => entry?.status === status).length;
			return actual === claimed ? null : `${status} (says ${claimed}, ${list} shows ${actual})`;
		})
		.filter((entry) => entry !== null);
	// Every count matching is not every entry being counted. Checking the counts one at a time asks
	// "does the summary describe the entries it mentions", and a status it does not mention is
	// invisible to that question: flipping one seam to a status with no column, and decrementing the
	// column it left, keeps every count truthful and the file exactly as long. The totals then say 37
	// of 38 seams, which is a passing artifact with an unreported failure in it.
	const counted = counts.reduce((total, [, claimed]) => total + claimed, 0);
	if (counted !== entries.length)
		disagreements.push(
			`the counts add up to ${counted} but there are ${entries.length} ${list}; ${entries.length - counted} of them ${entries.length - counted === 1 ? 'is' : 'are'} in no column at all`
		);
	const unaccounted = [
		...new Set(
			entries
				.map((entry) => entry?.status)
				.filter((status) => !counts.some(([name]) => name === status))
		)
	];
	if (unaccounted.length > 0)
		disagreements.push(
			`these statuses appear in ${list} and in no summary column: ${unaccounted.join(', ')}`
		);
	// A seam's status is a rollup of the checks beneath it, and only the rollup was being read. Setting
	// one nested check to "no" while the seam stays "ok" keeps every count truthful and every column
	// covered — the artifact then reports a seam as complete while recording that one of its artifacts
	// is not. `na` is a real status here and not a failure: 36 of these 38 seams carry one, for a
	// fixture module or an adapter a seam does not have, and demanding `ok` from every check would
	// reject the evidence this repository actually produces. Measured before it was written, because
	// four earlier rules in this file rejected correct evidence by assuming what a value meant.
	// An `ok` check names the artifact it found, and the name was never resolved. Renaming a contract
	// to `contract.zz` in the artifact — same width, inventory intact — left the seam ok and every
	// rule passing while the file it cites does not exist. Same shape as the Cipher Gate citations,
	// one artifact along: a recorded finding is a claim about a past scan, and the tree is what CI
	// has. `na` checks are excluded because their `path` is prose ("N/A (fixture module: …)"), which
	// is the honest way to record "there is nothing here to find".
	const missingArtifacts = entries
		.flatMap((entry) => (Array.isArray(entry?.checks) ? entry.checks : []))
		.filter((check) => check?.status === 'ok' && !isRepositoryArtifact(check.path))
		.map((check) => `${check?.kind} at "${check?.path}"`);
	if (missingArtifacts.length > 0)
		return `${file} reports these checks ok while the files they name are not artifacts in this tree: ${[...new Set(missingArtifacts)].join(', ')}; a check records what a scan found, and the tree is what is being reviewed.`;
	const ROLLED_UP = new Set(['ok', 'na']);
	const contradicted = entries
		.filter((entry) => entry?.status === 'ok')
		.flatMap((entry) =>
			(Array.isArray(entry.checks) ? entry.checks : [])
				.filter((check) => !ROLLED_UP.has(check?.status))
				.map((check) => `${entry.seam} is ok while its ${check?.kind} check reports "${check?.status}"`)
		);
	if (contradicted.length > 0) disagreements.push(...contradicted);
	if (disagreements.length === 0) return null;
	return `${file}'s summary disagrees with its own ${list}: ${disagreements.join('; ')}; the file was edited after it was written, or the stage that wrote it is inconsistent.`;
};

/**
 * Whether a recorded path names something inside this repository, and it is there.
 *
 * `existsSync` alone answers a question about the CI host, not about the tree under review:
 * `/etc/passwd` exists on the runner, and putting it in a seam's contract check left every rule
 * passing. A seam artifact is a repository-relative path that resolves inside the checkout, so both
 * halves are required — inside, and present.
 */
const REPOSITORY_ROOT = resolve('.');
const isRepositoryArtifact = (path) => {
	if (typeof path !== 'string' || path === '' || isAbsolute(path)) return false;
	const resolved = resolve(REPOSITORY_ROOT, path);
	if (resolved !== REPOSITORY_ROOT && !resolved.startsWith(`${REPOSITORY_ROOT}/`)) return false;
	return existsSync(resolved);
};

/**
 * What is wrong with a `cipher-gate.json`, or `null` — including when there isn't one.
 *
 * It states its result in a bare `status` rather than a summary, so the self-agreement rule below
 * did not reach it, and nothing else did either: setting it to "blocked" and fixing the inventoried
 * byte count left all eight rules passing. The verify chain does not run `cipher:gate`, so this
 * artifact is the only record that the gate was met. An unread result is the same as no result.
 */
const cipherGateProblem = (dir, raw) => {
	if (raw === null) return null;
	// Tied to the run, like every other transcript. This was the FOURTH artifact to need this, and it
	// was missed in the very commit whose log entry was about missing siblings — the tie went onto
	// e2e, the probes, the rewinds, lint and build, and not onto the one artifact that is the sole
	// record of a gate the chain does not run. Found this time by enumerating what the guard
	// validates and asking which of those are tied, instead of patching the one that was reported.
	const untied = notTiedToRun(dir, 'cipher-gate.json');
	if (untied !== null) return `${untied}, so its status cannot be trusted as this run's.`;
	let gate;
	try {
		gate = JSON.parse(raw);
	} catch {
		return 'cipher-gate.json is not readable as JSON, so the gate result cannot be established.';
	}
	const status = gate.status;
	if (status !== 'ok')
		return `cipher-gate.json reports status "${status}"; the Cipher Gate did not pass, and the verify chain does not run it, so this file is the only place that would say so.`;
	// The top-level status is a summary of the entries beneath it, and nothing was reading those. The
	// gate's whole content is a list of paths it confirmed exist; setting one entry's `exists` to
	// `null` — the same width as `true` — left the status ok, the byte count unchanged, and every rule
	// passing, while the artifact itself recorded that it could not confirm a cited file. Same defect
	// as the seam summaries above, one artifact along: a headline agreeing with nothing under it.
	const entries = gate.cipher?.evidence;
	if (!Array.isArray(entries) || entries.length === 0)
		return 'cipher-gate.json reports status ok but lists no evidence; a gate that cites nothing has confirmed nothing.';
	const unconfirmed = entries
		.filter((entry) => entry?.exists !== true || typeof entry?.path !== 'string' || entry.path === '')
		.map((entry) => (typeof entry?.path === 'string' && entry.path !== '' ? entry.path : '<no path>'));
	if (unconfirmed.length > 0)
		return `cipher-gate.json reports status ok while these cited files are not confirmed to exist: ${unconfirmed.join(', ')}; the gate's status is a summary of exactly these entries.`;
	// `exists: true` is what the gate believed when it ran. Whether the file is here now is a
	// different question, and only the second one can be answered from the committed tree: renaming a
	// cited path to `scripts/evidence-guard.zzz` while leaving the boolean alone kept every rule
	// passing, so a file could be deleted or renamed after the gate ran and the evidence stayed
	// certified. A recorded boolean is a claim about the past; `existsSync` is the check.
	const vanished = entries
		.map((entry) => entry.path)
		.filter((path) => !existsSync(path));
	if (vanished.length > 0)
		return `cipher-gate.json cites files that are not in this tree: ${vanished.join(', ')}; the gate recorded them as existing, and a recorded boolean is not the file.`;
	return null;
};

/**
 * What is wrong with an `assumption-alarm.json`, or `null` — including when there isn't one.
 *
 * It states its result as two arrays rather than a summary, so the self-agreement rule cannot reach
 * it: filling `invalidAssumptions` while preserving the byte count left every rule passing.
 * `scripts/assumption-alarm.mjs` exits 1 on either array being non-empty, which is what this reads.
 */
const assumptionAlarmProblem = (raw) => {
	if (raw === null) return null;
	let alarm;
	try {
		alarm = JSON.parse(raw);
	} catch {
		return 'assumption-alarm.json is not readable as JSON, so its result cannot be established.';
	}
	for (const field of ['invalidAssumptions', 'missingSeamCoverage']) {
		const value = alarm[field];
		if (!Array.isArray(value))
			return `assumption-alarm.json has no "${field}" array, so the alarm's result cannot be read.`;
		if (value.length > 0)
			return `assumption-alarm.json reports ${value.length} entries in "${field}"; the assumption alarm did not come back clean.`;
	}
	return null;
};

/**
 * Every file the proof tape inventories, flattened out of whatever shape it nests them in.
 *
 * One definition, because two rules now ask the tape what it lists: the chain-stage rule and the
 * lint/build rule. The second was added after a reviewer pointed out that a present, green lint
 * transcript proves nothing about WHICH run produced it — the tape is what ties a file to a run,
 * and nothing was asking it.
 */
const tapeInventory = (dir) => {
	const inventory = [];
	const collect = (node) => {
		if (Array.isArray(node)) return node.forEach(collect);
		if (node === null || typeof node !== 'object') return;
		if (typeof node.name === 'string' && typeof node.sizeBytes === 'number')
			inventory.push({
				name: node.name,
				sizeBytes: node.sizeBytes,
				predatesRun: node.predatesRun,
				// Carried through rather than dropped: every rule downstream resolves `name` against the
				// folder it is reading, so a `path` pointing somewhere else was simply discarded, and a
				// tape could name `fake/evidence/<date>/test.txt` while every rule passed.
				path: node.path
			});
		Object.values(node).forEach(collect);
	};
	collect(JSON.parse(read(dir, 'proof-tape.json') ?? '{}'));
	return inventory;
};

/**
 * Whether the tape ties one file to this run, as a sentence, or `null`.
 *
 * Exactly one inventory entry. The tape inventories this folder as the chain's last stage, and the
 * drift check compares that entry's size to the committed bytes — so a file the tape lists is a file
 * that existed, at that length, when this run's chain executed. A transcript copied in afterwards is
 * not inventoried at all.
 *
 * This is the THIRD time a fix has been applied to one artifact and left its siblings: the exit
 * status went into `e2e` while `verify`, `lint` and `build` kept the old check; the file header went
 * onto lint and build while the rewind transcript kept none; and the inventory requirement went onto
 * lint and build while `e2e.txt`, the probes and the rewinds — the artifacts that carry the mandated
 * results — were never asked for one. Deleting one instance of a defect is not deleting the defect.
 */
const notTiedToRun = (dir, file) => {
	const entries = tapeInventory(dir).filter((entry) => entry.name === file);
	if (entries.length === 1) return null;
	return `${file} is present but the proof tape carries ${entries.length} inventory entries for it, so it cannot be shown to belong to this run rather than an earlier one`;
};

/**
 * Whether this folder is a copy of some other run's evidence, as a sentence, or `null` if it is not.
 *
 * The tape records `evidenceDir` and `generatedAt` and nothing was reading either, so an entire
 * internally consistent old run could be copied to a new dated path and satisfy every other rule —
 * each artifact genuinely agreeing with the others, all of them from a run with nothing to do with
 * this change. Copying `2026-09-05` to `2099-01-01` passed all six. The identity was already in the
 * file; the guard simply never asked for it.
 */
const replayedFrom = (dir, tape) => {
	// `basename` strips trailing separators itself; the hand-rolled strip that used to be here was
	// both redundant and, per sonarjs/super-linear-regex, a backtracking pattern.
	//
	// Separators normalised first. `proof-tape.mjs` joins this path, so a tape generated on Windows
	// records `docs\\evidence\\2026-09-05`, and POSIX `basename` treats a backslash as an ordinary
	// character — it would return the whole string and this rule would reject valid evidence as a
	// replay. That is the rule doing the opposite of its job: three of this guard's earlier bugs were
	// correct evidence refused, and this one was introduced by the fix for evidence wrongly accepted.
	// Trailing separators trimmed without a regex: `/\/+$/` backtracks, which `sonarjs/super-linear-regex`
	// flags and which is a real cost on a long path. A loop over the end of the string is linear and
	// says what it does.
	const slashed = (value) => {
		const forward = value.replace(/\\/g, '/');
		let end = forward.length;
		while (end > 0 && forward[end - 1] === '/') end -= 1;
		return forward.slice(0, end);
	};
	const here = basename(slashed(dir));
	const claimed = typeof tape.evidenceDir === 'string' ? slashed(tape.evidenceDir) : null;
	if (claimed === null)
		return 'proof-tape.json records no evidenceDir, so it cannot be shown to describe this folder rather than another one.';
	// The WHOLE path, not its last segment. Comparing basenames asked whether the tape names a folder
	// with the same name, which `fake/evidence/2026-09-06` also satisfies — a tape generated for, or
	// edited to name, some other directory was certified as describing this repository's evidence.
	// The one thing normalised is the separator, because `proof-tape.mjs` joins this path and a tape
	// written on Windows records `docs\evidence\2026-09-06`, which is the same folder.
	if (claimed !== `${EVIDENCE_ROOT}/${here}`)
		return `proof-tape.json says it describes "${claimed}" but it is committed in "${EVIDENCE_ROOT}/${here}"; this folder is a copy of another run's evidence, or the tape was written for a different directory.`;
	// The run's own clock has to agree with the folder it is filed under. A dated folder names a day;
	// a tape stamped on a different day is a replay filed under a fresh name.
	if (!/^\d{4}-\d{2}-\d{2}$/.test(here)) return null;
	const stamped = typeof tape.generatedAt === 'string' ? tape.generatedAt.slice(0, 10) : null;
	if (stamped !== here)
		return `proof-tape.json is stamped ${stamped ?? '<no generatedAt>'} but filed under ${here}; the run and the folder disagree about when it happened.`;
	// A folder and a tape can agree with each other about a day that has not happened. The rules above
	// only ask whether the two match, so renaming this folder to 2099-09-06 and moving the tape's date
	// with it satisfied every one of them — and `clan-chain.mjs` and `proof-tape.mjs` both select the
	// lexicographically newest dated folder, so that folder becomes the input to every later run,
	// feeding them evidence from a run that has not occurred. Consistency is not identity, and two
	// files agreeing about a date is not a date.
	const today = toDateFolder(new Date());
	if (here > today)
		return `this folder is dated ${here}, which is after today (${today}); a run cannot have produced evidence on a day that has not happened, and the chain's stages take the newest dated folder as their input.`;
	return null;
};

/** The two files the tape writes after taking its inventory, and therefore cannot list. */
const TAPE_OWN_OUTPUTS = ['proof-tape.json', 'proof-tape.md'];

// `- <name> (<n> bytes)[ — <freshness>]`, the one line shape `scripts/proof-tape.mjs` renders per
// inventoried file. The name is greedy and the size is anchored to the end, so a filename that
// itself contains a parenthesis — this folder ships one — still parses.
const MD_ENTRY = /^- (.+) \((\d{1,12}) bytes\)(.*)$/;
const PREDATES_MARKER = ' — PREDATES THIS VERIFY RUN';
const UNKNOWN_MARKER = ' — FRESHNESS UNKNOWN';
const freshnessMarker = (predatesRun) => {
	if (predatesRun === true) return PREDATES_MARKER;
	if (predatesRun === null) return UNKNOWN_MARKER;
	return '';
};

/**
 * Whether `proof-tape.md` still says what `proof-tape.json` says, as a sentence, or `null`.
 *
 * The tape writes both of its own outputs after taking its inventory, so neither appears in it —
 * which left the plain-English summary as the one mandatory artifact no rule could reach. Deleting
 * it, truncating it, or rewriting its byte counts left every rule passing, because the only thing
 * that would have noticed was an inventory that structurally cannot contain it. The chain is
 * required to produce that summary; the guard was certifying folders without one, and folders whose
 * summary described a different run than the report beside it.
 *
 * Re-derived from the JSON rather than by re-running the renderer. Importing
 * `scripts/proof-tape.mjs` would compare the committed file against a function from the same branch
 * under review — a check that agrees with whatever the change made it say, in exactly the case it
 * exists for. This guard executes no repository code by design: CI runs it before `npm install`, and
 * with `node` rather than `npm run`, for that same reason.
 */
/** The seam names listed under one heading of `clan-chain.md`. */
const namedUnder = (md, heading, next) => {
	const start = md.indexOf(`${heading}\n`);
	if (start === -1) return null;
	const rest = md.slice(start + heading.length);
	const end = next === null ? rest.length : rest.indexOf(`${next}\n`);
	const section = end === -1 ? rest : rest.slice(0, end);
	return section
		.split('\n')
		.map((line) => /^- (.+) \(owner: /.exec(line)?.[1])
		.filter((name) => name !== undefined);
};

/** The seam names one artifact lists, or `null` when it has no seams list at all. */
const seamNamesIn = (raw) => {
	if (raw === null) return null;
	let parsed;
	try {
		parsed = JSON.parse(raw);
	} catch {
		return null;
	}
	return Array.isArray(parsed.seams) ? parsed.seams.map((entry) => entry?.seam) : null;
};

/** `scripts/seam-ledger.mjs` renders each status as one of these; anything else is "?" there too. */
const STATUS_CELL = { ok: '\u2705', missing: '\u274c', blocked: '\u26d4', na: '\u2014' };

/**
 * Whether every status cell in the ledger table says what the JSON says, as a sentence, or `null`.
 *
 * Comparing the seam names alone leaves the columns unread: a cell flipped from ok to missing, in the
 * table a non-coder actually looks at, disagrees with the JSON beside it and nothing noticed. The
 * cells are the ledger's content; the names are only its index.
 */
const cellsProblem = (md, ledger) => {
	const rows = md
		.split('\n')
		.filter((line) => line.startsWith('|'))
		.map((line) => line.split('|').slice(1, -1).map((cell) => cell.trim()));
	const header = rows.find((cells) => cells[0] === 'Seam');
	if (header === undefined) return 'seam-ledger.md has no header row, so its columns cannot be read.';
	// Every column the JSON records, present in the table. Comparing only the columns the table
	// happens to have made a whole class of results disappear by deleting its header: remove the
	// Contract column and every contract check went uncompared, silently. A missing column is not a
	// column that agrees.
	const columns = new Set(header.map((name) => name.toLowerCase()));
	const kinds = [
		'status',
		...new Set(
			(Array.isArray(ledger.seams) ? ledger.seams : [])
				.flatMap((seam) => (Array.isArray(seam?.checks) ? seam.checks : []))
				.map((check) => String(check?.kind).toLowerCase())
		)
	];
	const absentColumns = kinds.filter((kind) => !columns.has(kind));
	if (absentColumns.length > 0)
		return `seam-ledger.md has no column for: ${absentColumns.join(', ')}; the JSON records those results for every seam and the table reports none of them.`;
	const disagreements = [];
	for (const seam of ledger.seams) {
		const row = rows.find((cells) => cells[0] === seam?.seam);
		if (row === undefined) continue; // the name comparison above owns that case
		const compare = (column, status) => {
			const at = header.findIndex((name) => name.toLowerCase() === column);
			if (at === -1) return;
			const wanted = STATUS_CELL[status] ?? '?';
			if (row[at] !== wanted)
				disagreements.push(`${seam.seam}'s ${column} cell reads "${row[at]}" and the JSON says "${status}"`);
		};
		compare('status', seam?.status);
		for (const check of Array.isArray(seam?.checks) ? seam.checks : [])
			compare(String(check?.kind).toLowerCase(), check?.status);
	}
	if (disagreements.length === 0) return null;
	return `seam-ledger.md and seam-ledger.json disagree cell by cell: ${disagreements.join('; ')}.`;
};

/**
 * Whether `seam-ledger.md` names the same seams as `seam-ledger.json`, as a sentence, or `null`.
 *
 * The ledger stage writes both, and only the JSON was required: a folder could omit the table a
 * non-coder actually reads, be absent from both proof-tape outputs as a result, and pass every rule.
 * Requiring it to exist is half the fix — a summary that exists and disagrees is the defect this
 * whole branch is about — so it is compared with the JSON the way the Clan Chain's two outputs are.
 */
const seamLedgerSummaryProblem = (dir) => {
	const md = read(dir, 'seam-ledger.md');
	if (md === null) return 'seam-ledger.md is missing; the ledger stage writes a table beside its JSON.';
	const raw = read(dir, 'seam-ledger.json');
	if (raw === null) return 'seam-ledger.json is missing; it is a mandatory chain artifact.';
	let ledger;
	try {
		ledger = JSON.parse(raw);
	} catch {
		return 'seam-ledger.json is not readable as JSON, so the table cannot be checked against it.';
	}
	const seams = Array.isArray(ledger.seams) ? ledger.seams.map((entry) => entry?.seam) : null;
	if (seams === null) return 'seam-ledger.json carries no seams list, so its table describes nothing.';
	// The first column of each table row, skipping the header and its divider.
	// Split rather than matched. `/^\|\s*([^|]+?)\s*\|/` is a lazy group between two `\s*`, which
	// backtracks; a Markdown row is delimited text, so splitting on the delimiter is both linear and
	// the more honest reading of the format.
	const tabled = md
		.split('\n')
		.filter((line) => line.startsWith('|'))
		.map((line) => line.split('|')[1]?.trim())
		.filter((name) => name !== undefined && name !== '' && name !== 'Seam' && !/^-{1,64}$/.test(name));
	const missing = seams.filter((seam) => !tabled.includes(seam));
	const extra = tabled.filter((seam) => !seams.includes(seam));
	if (missing.length === 0 && extra.length === 0) return cellsProblem(md, ledger);
	return `seam-ledger.md and seam-ledger.json disagree about which seams exist: ${[
		missing.length > 0 ? `the JSON lists these and the table omits them: ${missing.join(', ')}` : null,
		extra.length > 0 ? `the table lists these and the JSON does not: ${extra.join(', ')}` : null
	]
		.filter((part) => part !== null)
		.join('; ')}.`;
};

/**
 * Whether the ledger's ok seams are the seams `chamber-lock.json` found, as a sentence, or `null`.
 *
 * A second source, because the chain and the ledger agreeing proves only that they agree. Emptying
 * the ledger, both chain lists and their summaries together left every rule passing while the lock in
 * the same folder still listed 38 seams: three files consistent with each other and with nothing
 * else. The lock is written by a different stage from a different scan.
 */
const ledgerAgainstLock = (dir, ledgerOk) => {
	const registered = seamNamesIn(read(dir, 'chamber-lock.json'));
	if (registered === null)
		return 'chamber-lock.json carries no seams list, so the ledger has nothing independent to be checked against.';
	if (registered.length === 0)
		return 'chamber-lock.json lists no seams at all; a repository with no seams is not a passing chain, it is a chain that scanned nothing.';
	const unknown = ledgerOk.filter((seam) => !registered.includes(seam));
	const unledgered = registered.filter((seam) => !ledgerOk.includes(seam));
	if (unknown.length === 0 && unledgered.length === 0) return null;
	return `seam-ledger.json and chamber-lock.json disagree about which seams exist: ${[
		unknown.length > 0 ? `the ledger reports these ok and the lock does not list them: ${unknown.join(', ')}` : null,
		unledgered.length > 0 ? `the lock lists these and the ledger does not report them ok: ${unledgered.join(', ')}` : null
	]
		.filter((part) => part !== null)
		.join('; ')}.`;
};

/**
 * Whether the Clan Chain agrees with the ledger it is derived from and with its own summary, as a
 * sentence, or `null`.
 *
 * `clan-chain.json` states its result as two lists rather than a summary, so the self-agreement rule
 * could not reach it and nothing else looked. Swapping the two property names keeps the file exactly
 * as long and turns 38 clean seams into 38 dirty ones, while the ledger and the Markdown beside it
 * still report them clean — a mandatory artifact reporting the opposite of its neighbours, with every
 * rule passing. Third artifact on this branch to state a result in a shape no rule was reading, after
 * `cipher-gate.json` and `assumption-alarm.json`.
 */
const clanChainProblem = (dir) => {
	const raw = read(dir, 'clan-chain.json');
	if (raw === null) return 'clan-chain.json is missing; it is a mandatory chain artifact.';
	let chain;
	try {
		chain = JSON.parse(raw);
	} catch {
		return 'clan-chain.json is not readable as JSON, so what the chain reports cannot be established.';
	}
	const clean = Array.isArray(chain.clean) ? chain.clean : null;
	const dirty = Array.isArray(chain.dirty) ? chain.dirty : null;
	if (clean === null || dirty === null)
		return 'clan-chain.json has no "clean" and "dirty" lists, so what the chain reports cannot be read.';
	if (dirty.length > 0)
		return `clan-chain.json reports ${dirty.length} dirty seams: ${dirty.map((entry) => entry?.seam ?? '<unnamed>').join(', ')}; the chain did not come back clean.`;
	const ledgerRaw = read(dir, 'seam-ledger.json');
	const ledger = ledgerRaw === null ? null : JSON.parse(ledgerRaw);
	const ledgerOk = Array.isArray(ledger?.seams)
		? ledger.seams.filter((entry) => entry?.status === 'ok').map((entry) => entry?.seam)
		: null;
	if (ledgerOk === null)
		return 'seam-ledger.json carries no seams list, so the Clan Chain cannot be checked against it.';
	// A second source, because the chain and the ledger agreeing proves only that they agree. Emptying
	// the ledger, both chain lists and their summaries together left all eight rules passing while
	// `chamber-lock.json` in the same folder still listed 38 seams: three files consistent with each
	// other and with nothing else. The lock is written by a different stage from a different scan, so
	// it is the independent record this comparison was missing.
	const independent = ledgerAgainstLock(dir, ledgerOk);
	if (independent !== null) return independent;
	// The NAMES, not the count. Comparing cardinality asks whether two lists are the same length,
	// which they remain when one clean seam is replaced by an equal-length invention — in both chain
	// outputs at once, so they agree with each other about a seam the ledger has never heard of. The
	// chain is derived from the ledger; "derived from" is a claim about which seams, not how many.
	const chainNames = new Set(clean.map((entry) => entry?.seam));
	const ledgerNames = new Set(ledgerOk);
	const invented = [...chainNames].filter((seam) => !ledgerNames.has(seam));
	const dropped = [...ledgerNames].filter((seam) => !chainNames.has(seam));
	if (invented.length > 0 || dropped.length > 0)
		return `clan-chain.json and seam-ledger.json disagree about which seams are clean: ${[
			invented.length > 0 ? `the chain calls these clean and the ledger does not list them: ${invented.join(', ')}` : null,
			dropped.length > 0 ? `the ledger reports these ok and the chain omits them: ${dropped.join(', ')}` : null
		]
			.filter((part) => part !== null)
			.join('; ')}.`;
	return chainSummaryProblem(dir, clean);
};

/** Whether `clan-chain.md` names the same clean seams as the JSON beside it, as a sentence, or `null`. */
const chainSummaryProblem = (dir, clean) => {
	const md = read(dir, 'clan-chain.md');
	if (md === null)
		return 'clan-chain.md is missing; the chain writes a plain-English summary beside the JSON.';
	const listedClean = namedUnder(md, 'Clean seams:', 'Dirty seams:');
	const listedDirty = namedUnder(md, 'Dirty seams:', null);
	if (listedClean === null || listedDirty === null)
		return 'clan-chain.md has no "Clean seams:" and "Dirty seams:" sections, so it cannot be compared with the JSON.';
	const named = new Set(clean.map((entry) => entry?.seam));
	const disagreements = [];
	const onlyInMd = listedClean.filter((name) => !named.has(name));
	if (onlyInMd.length > 0)
		disagreements.push(`the summary calls these clean and the JSON does not: ${onlyInMd.join(', ')}`);
	const onlyInJson = [...named].filter((name) => !listedClean.includes(name));
	if (onlyInJson.length > 0)
		disagreements.push(`the JSON calls these clean and the summary does not: ${onlyInJson.join(', ')}`);
	if (listedDirty.length > 0)
		disagreements.push(`the summary lists ${listedDirty.length} dirty seams`);
	if (disagreements.length === 0) return null;
	return `clan-chain.md and clan-chain.json disagree about the chain: ${disagreements.join('; ')}.`;
};

/** The summary's per-file rows, keyed by name. */
const summaryRows = (md) => {
	const rows = new Map();
	for (const line of md.split('\n')) {
		const entry = MD_ENTRY.exec(line);
		if (entry !== null) rows.set(entry[1], { sizeBytes: Number(entry[2]), marker: entry[3] });
	}
	return rows;
};

/** Every point on which the summary's rows and the report's inventory differ, as sentences. */
const summaryDisagreements = (inventory, rows) => {
	const said = [];
	for (const { name, sizeBytes, predatesRun } of inventory) {
		const row = rows.get(name);
		if (row === undefined) {
			said.push(`${name} is inventoried but the summary does not mention it`);
		} else if (row.sizeBytes !== sizeBytes) {
			said.push(`${name} is inventoried at ${sizeBytes} bytes and summarised as ${row.sizeBytes}`);
		} else if (row.marker !== freshnessMarker(predatesRun)) {
			const claim = row.marker.trim() || 'part of this run';
			said.push(`${name} is summarised as "${claim}" and the report says otherwise`);
		}
	}
	const inventoried = new Set(inventory.map((entry) => entry.name));
	for (const name of rows.keys())
		if (!inventoried.has(name))
			said.push(`${name} is summarised but the report inventories no such file`);
	return said;
};

const proofSummaryProblem = (dir, inventory, tape) => {
	const md = read(dir, 'proof-tape.md');
	if (md === null)
		return 'proof-tape.md is missing; the chain writes a plain-English summary beside the JSON, and it is the half of the tape a reader who is not reading JSON will read.';
	const carries = (label, value) =>
		typeof value === 'string' && md.includes(`\n${label}: ${value}\n`);
	if (!carries('Generated at', tape.generatedAt))
		return `proof-tape.md does not carry "Generated at: ${tape.generatedAt}"; the summary and the report it summarises describe different runs.`;
	if (!carries('Evidence folder', tape.evidenceDir))
		return `proof-tape.md does not carry "Evidence folder: ${tape.evidenceDir}"; the summary and the report it summarises describe different folders.`;
	const disagreements = summaryDisagreements(inventory, summaryRows(md));
	if (disagreements.length === 0) return null;
	return `proof-tape.md disagrees with proof-tape.json: ${disagreements.join('; ')}; a summary is a new claim, not a smaller copy of its source, and this one is making a claim the report does not support.`;
};

/**
 * Whether every chain artifact's own stamp is dated the folder it sits in, as a sentence, or `null`.
 *
 * The tape's date was already required to match the folder, and the lock's was only required not to
 * be newer than the tape's — so a lock from an earlier tree, copied in before the chain ran, was
 * marked current by the tape and certified the run. `generatedAt` is written by the stage itself,
 * which is what makes it worth reading: nothing else in the folder says when a stage ran.
 */
const misdatedStages = (dir, artifacts) => {
	const here = basename(dir);
	const stampOf = (name) => {
		const raw = name.endsWith('.json') ? read(dir, name) : null;
		if (raw === null) return undefined;
		try {
			return JSON.parse(raw).generatedAt;
		} catch {
			return undefined; // an unreadable artifact is its own rule's finding
		}
	};
	if (/^\d{4}-\d{2}-\d{2}$/.test(here)) {
		const stampedElsewhere = artifacts.filter((name) => {
			const at = stampOf(name);
			return at !== undefined && (typeof at !== 'string' || at.slice(0, 10) !== here);
		});
		if (stampedElsewhere.length > 0)
			return `these chain artifacts are stamped on a different day from the folder they are filed under (${here}): ${stampedElsewhere.join(', ')}; a stage that ran on another day did not run for this evidence.`;
	}
	// Inside the run, not merely on its day. Comparing the date alone accepts a ledger stamped
	// 00:00:00 — before this run's chamber lock, by hours — so a stale artifact from an earlier run
	// on the same day was certified as part of this chain. The lock opens the run and the tape closes
	// it, so every stage between them must be stamped between them.
	// A stamp that cannot be read is not a stamp. `Date.parse` gives NaN for a missing or corrupted
	// `generatedAt`, and excluding NaN from the comparison below meant deleting the field put a stage
	// outside every check rather than inside a failing one — the fifth time on this branch that
	// "unknown" has been treated as "fine".
	const unstamped = artifacts.filter(
		(name) => name.endsWith('.json') && Number.isNaN(Date.parse(stampOf(name) ?? ''))
	);
	if (unstamped.length > 0)
		return `these chain artifacts carry no readable generatedAt: ${unstamped.join(', ')}; a stage that does not say when it ran cannot be tied to this run.`;
	const opened = Date.parse(stampOf('chamber-lock.json') ?? '');
	const closed = Date.parse(stampOf('proof-tape.json') ?? '');
	if (Number.isNaN(opened) || Number.isNaN(closed)) return null; // unreachable: named above
	const outside = artifacts.filter((name) => {
		const at = Date.parse(stampOf(name) ?? '');
		return !Number.isNaN(at) && (at < opened || at > closed);
	});
	if (outside.length > 0)
		return `these chain artifacts are stamped outside this run's window (${new Date(opened).toISOString()} to ${new Date(closed).toISOString()}): ${outside.join(', ')}; the lock opens the run and the tape closes it, so a stage stamped outside them belongs to a different one.`;
	return null;
};

/**
 * Whether every inventory entry describes a file in this folder, at the length recorded, or `null`.
 *
 * Two questions, both about the same entries: where the tape says the file is, and how big it says
 * it is. The second was checked from the start and the first was thrown away by the collector, so a
 * tape could record `fake/evidence/<date>/test.txt` with a correct name and size and every rule
 * passed — every other rule resolves `name` against the folder it is reading, so nothing ever
 * consulted the path.
 */
const inventoryProblem = (dir, inventory, postTape) => {
	const here = `${EVIDENCE_ROOT}/${basename(dir)}`;
	const misplaced = inventory
		.filter(({ name, path: recorded }) =>
			typeof recorded !== 'string' ? true : recorded.replace(/\\/g, '/') !== `${here}/${name}`
		)
		.map(({ name, path: recorded }) => `${name} is recorded at "${recorded ?? '<no path>'}"`);
	if (misplaced.length > 0)
		return `the proof tape records files outside the folder it describes: ${misplaced.join('; ')}; every entry belongs to ${here}.`;
	// The other direction. Everything asked so far is "does each entry describe a file"; nothing asked
	// "is each file described". Dropping an uninventoried `ci-verify.txt` carrying a failing status
	// into the folder passed every rule, and the tape itself says it excludes only its own two
	// outputs — so a file it does not list is either evidence from another run or evidence the tape
	// never saw, and both are untraceable.
	const listed = new Set(inventory.map((entry) => entry.name));
	const uninventoried = readdirSync(dir, { withFileTypes: true })
		.filter((entry) => entry.isFile())
		.map((entry) => entry.name)
		.filter((name) => !listed.has(name) && !TAPE_OWN_OUTPUTS.includes(name));
	if (uninventoried.length > 0)
		return `these files are in the folder and in no inventory entry: ${uninventoried.join(', ')}; the tape excludes only its own two outputs, so anything else it does not list cannot be tied to this run.`;
	const drifted = inventory
		.filter(({ name }) => !postTape.has(name))
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
			const outerExit = exitStatusProblem(outer, 'verify');
			if (outerExit !== null)
				return `verify-outer.txt ${outerExit}; it was captured before the chain finished, or the chain failed.`;
			// Markers that only stage OUTPUT produces. An earlier version looked for 'proof', which
			// appears in the echoed `npm run verify` command line at the top of the transcript — so a
			// transcript truncated right after the test summary, with an exit line appended, satisfied
			// it while none of the post-test stages had run. A marker that the header can supply is not
			// a marker. The stages after the tests print nothing distinctive, so they are proved from
			// their artifacts below rather than from this file.
			//
			// The audit gate is the chain's FIRST stage and nothing here required evidence of it, so a
			// branch that dropped `audit:gate` from its own `verify` script and refreshed the evidence
			// passed: the workflow's Verify step delegates to that same branch-owned script, so no
			// high-severity audit would have run anywhere. Both markers are stage OUTPUT — npm's own
			// banner line for the sub-script, and the audit's result — because the echoed command line
			// at the top of this transcript contains the string `audit:gate`, which is exactly how the
			// old `proof` marker was satisfied by a transcript in which proof-tape never ran. Verified
			// against a header-only transcript: neither pattern matches it.
			//
			// The result pattern counts vulnerabilities rather than demanding zero. `--audit-level=high`
			// exits 0 with low and moderate advisories present, and "found 3 moderate severity
			// vulnerabilities" is a passing audit; requiring "found 0" would reject it. npm puts the
			// severity between the count and the noun, so the pattern allows those words — the first
			// version said all of this in a comment and then matched only `found <n> vulnerabilit`,
			// which rejects every audit that is passing but not perfectly clean. The comment was
			// right and the code beneath it was not, which is the defect this whole guard is about.
			// The audit section, computed before the markers so the audit's own result can be required
			// INSIDE it. Scoping the severity check and leaving the result marker searching the whole
			// transcript is the fifth time in this run a fix landed on one of two adjacent things —
			// and this pair sat three lines apart in the same block. Moving the committed
			// `found 0 vulnerabilities` line down past the Vitest output still satisfied the marker,
			// so an audit that produced no result at all could be certified by a later stage's text.
			const clean = stripAnsi(outer);
			const auditStart = clean.search(/^> \S{1,80} audit:gate$/m);
			const afterBanner = auditStart === -1 ? '' : clean.slice(auditStart + 1);
			// npm's script banner is `> <name>@<version> <script>`; the line right after it is the
			// command echo, `> npm audit --audit-level=high`, which has no `@` in its first token. An
			// earlier attempt matched both, so the section ended immediately and was empty — the check
			// scoped itself out of existence and reported nothing wrong, which is how a vacuous check
			// looks from the outside.
			const nextBanner = afterBanner.search(/^> \S{1,80}@\S{1,40} \S/m);
			const auditSection = nextBanner === -1 ? afterBanner : afterBanner.slice(0, nextBanner);
			const STAGE_MARKERS = [
				{ pattern: /^> \S{1,80} audit:gate$/m, stage: 'the audit gate' },
				{
					pattern: /found \d{1,9}( \w{1,12}){0,2} vulnerabilit/,
					stage: "the audit gate's result",
					within: 'audit'
				},
				{ pattern: /svelte-check found 0 errors/, stage: 'a clean check stage' },
				{ pattern: /Test Files/, stage: 'the test stage' }
			];
			// `--audit-level=high` makes high and critical advisories a non-zero exit, so one reported
			// here alongside `verify exit=0` means a branch-owned `audit:gate` masked it. Low and
			// moderate findings are a passing audit and stay allowed.
			if (/(high|critical) severity/.test(auditSection))
				return 'verify-outer.txt reports a high or critical severity advisory; --audit-level=high makes that a failing audit, so the chain exiting zero means its own audit script masked the result.';
			const missing = STAGE_MARKERS.filter(
				({ pattern, within }) => !pattern.test(within === 'audit' ? auditSection : outer)
			);
			if (missing.length > 0)
				return `verify-outer.txt is missing ${missing.map((m) => m.stage).join(', ')}; it carries an exit line but not the run that earned it.`;
			// The chain's exit status is the chain's, not each stage's. A branch-owned `check` or
			// `test` script that masks its command — `|| true` — leaves the outer command exiting zero
			// over a transcript that says, in the reporter's own words, that something failed. The
			// markers above proved the stages spoke; this asks what they said.
			const outerFailure = reportedFailure(outer);
			if (outerFailure !== null)
				return `verify-outer.txt exits zero but its own summary reports "${outerFailure}"; the chain's exit status is not each stage's result.`;
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
			const innerFailure = reportedFailure(inner);
			if (innerFailure !== null)
				return `test.txt reports "${innerFailure}"; the totals agreeing does not make the run green.`;
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
				'seam-ledger.md',
				'clan-chain.json',
				'clan-chain.md',
				'proof-tape.json'
			];
			const inventory = tapeInventory(dir);
			// `proof-tape.md` is required here and is NOT a member of the list above, because every
			// check below asks the inventory about each name and the tape cannot inventory its own
			// outputs. That exemption was the hole: the mandatory-artifact list stopped at
			// `proof-tape.json`, so the plain-English summary the chain must write was the one
			// artifact no rule read — deleting it left all eight rules passing.
			// `seam-ledger.md` and `clan-chain.md` are written by their stages exactly as the JSON is,
			// and the list stopped at the JSON — so a folder could omit the human-readable ledger, be
			// missing from both proof-tape outputs as a result, and pass. They are in the inventory
			// (unlike the tape's own two outputs), so they are required here AND carried through the
			// checks below rather than exempted.
			const absent = [...CHAIN_ARTIFACTS, 'proof-tape.md'].filter(
				(name) => read(dir, name) === null
			);
			if (absent.length > 0)
				return `these chain stages left no artifact: ${absent.join(', ')}; the chain did not run all of them.`;
			// The tape has to be describing THIS folder. It already records `evidenceDir` and
			// `generatedAt`, and nothing here read either, so an entire internally consistent old run
			// could be copied to a new dated path and satisfy every rule below — each artifact
			// genuinely agreeing with the others, all of them from a run that has nothing to do with
			// this change. Copying `2026-09-05` to `2099-01-01` passed all six. The identity was
			// already in the file; the guard simply never asked for it.
			const tapeReport = JSON.parse(read(dir, 'proof-tape.json') ?? '{}');
			const misfiled = replayedFrom(dir, tapeReport);
			if (misfiled !== null) return misfiled;

			// The tape SAYS which files it left out, and nothing read that either. The exemption below
			// is granted to two names on the grounds that the tape cannot list them; a tape that
			// quietly started excluding a third would have been given the same grounds by a guard that
			// never asked what it excluded. (An excluded chain artifact is still caught by the entry
			// count below — this catches the claim itself, one step earlier.)
			// Compared as a set rather than by sorting both sides and joining them. Two names in either
			// order mean the same thing, and `Array.prototype.sort()` with no comparator is a defect
			// waiting for a caller who passes something that is not a string.
			const excluded = Array.isArray(tapeReport.excludedFromInventory)
				? tapeReport.excludedFromInventory
				: null;
			const exemptsItsOwnOutputsOnly =
				excluded !== null &&
				excluded.length === TAPE_OWN_OUTPUTS.length &&
				TAPE_OWN_OUTPUTS.every((name) => excluded.includes(name));
			if (!exemptsItsOwnOutputsOnly) {
				const names = excluded === null ? 'files it does not name' : excluded.join(', ');
				return `proof-tape.json excludes ${names} from its inventory; the only files it cannot list are its own two outputs, and an inventory that omits anything else is not an inventory of this folder.`;
			}

			// The plain-English half of the tape, checked against the machine-readable half. Neither
			// appears in the inventory, so nothing downstream of here can reach it.
			const summarised = proofSummaryProblem(dir, inventory, tapeReport);
			if (summarised !== null) return summarised;

			// Present is not current. A run that stops invoking an intermediate stage leaves the previous
			// artifact in place, and the tape then flags it as predating this run while everything else
			// looks finished. The tape already computes that; nothing was reading it.
			//
			// Before the staleness question can be asked, the tape has to have an answer to it. Asking
			// `some(name matches && predatesRun)` returns false in two different situations — the tape
			// says the artifact is current, and the tape does not mention the artifact at all — and only
			// the first is a pass. An artifact the inventory omits is skipped by the drift check below
			// for the same reason, so a file the tape stops scanning becomes invisible to this rule
			// rather than suspect. That is invariant 3 at the top of this file, inverted: a rule that
			// cannot be evaluated was reporting success.
			//
			// `proof-tape.json` is the one chain artifact its own inventory cannot contain: the tape is
			// written from the scan, so it is not in the scan. This folder's tape has exactly one entry
			// for each of the other seven and none for itself, which is what that exclusion is measured
			// against rather than assumed from. Its currency is what the stamp comparison below is for.
			const TAPE = 'proof-tape.json';
			const uninventoried = CHAIN_ARTIFACTS.filter(
				(name) =>
					name !== TAPE && inventory.filter((entry) => entry.name === name).length !== 1
			);
			if (uninventoried.length > 0)
				return `the proof tape does not carry exactly one inventory entry for: ${uninventoried.join(', ')}; whether those artifacts belong to this run cannot be read off a tape that does not describe them.`;
			// `=== false`, not `!== true`. An entry whose `predatesRun` is null or absent reports that the
			// tape could not establish the file's freshness, and rejecting only `true` read that as
			// fresh — the third time in this file that "unknown" has been counted as "fine", after the
			// missing inventory entry and the absent lint transcript. The tape says false for every
			// chain artifact it can date, which is what this is measured against.
			const unfresh = CHAIN_ARTIFACTS.filter((name) => {
				if (name === TAPE) return false;
				const entry = inventory.find((candidate) => candidate.name === name);
				return entry?.predatesRun !== false;
			});
			if (unfresh.length > 0)
				return `the proof tape does not report these chain artifacts as belonging to its own run: ${unfresh.join(', ')}; it marks them as predating it, or cannot say.`;
			// Each stage's own stamp, against the folder's date. The tape's date was already required to
			// match, and the lock's was only required not to be NEWER than the tape's — so a lock from
			// an earlier tree, copied in before the chain ran, was inventoried as current and certified
			// the run. `generatedAt` is written by the stage itself, which is what makes it worth
			// reading; nothing else in the folder says when a stage ran.
			const misdated = misdatedStages(dir, CHAIN_ARTIFACTS);
			if (misdated !== null) return misdated;
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
			// Where the tape says each file is, not only how big it is. Every rule here resolves an
			// entry's `name` against the folder being read, so an entry whose `path` points outside it
			// was never contradicted by anything: `fake/evidence/<date>/test.txt` passed with the name
			// and the size intact. A tape that cannot say where its files are is not an inventory of
			// this folder.
			return inventoryProblem(dir, inventory, POST_TAPE);
		}
	},
	{
		name: 'e2e.txt Row 2 carries its own result',
		check: (dir) => {
			const e2e = read(dir, 'e2e.txt');
			if (e2e === null) return null; // not every change runs the end-to-end suite
			const e2eUntied = notTiedToRun(dir, 'e2e.txt');
			if (e2eUntied !== null) return `${e2eUntied}; the mandated end-to-end result cannot rest on a transcript the chain never saw.`;
			const marker = e2e.indexOf('## Row 2');
			if (marker === -1)
				return 'e2e.txt has no "## Row 2" section; the mandated command and the run that actually executes are both meant to be recorded.';
			// Scoped to Row 2 on purpose. Reading the whole file lets Row 1 mask an empty Row 2 —
			// the mandated command can execute partially and print its own "1 passed" before failing,
			// and the splice failure this rule exists to catch would then pass. Row 2 is the row whose
			// result gets cited, so Row 2 is what gets checked.
			// Row 1 first. Slicing straight to Row 2 meant the MANDATED command was never read at all:
			// a run whose `npx playwright test` failed outright passed this gate because the override
			// beside it succeeded. An override is a substitute for a browser, not for a requirement.
			// `docs/evidence/README.md` provides the only honest way through — record the reason and a
			// waiver expiry — so a red mandated row is allowed exactly when it says why and until when.
			const mandatedProblem = mandatedRowProblem(e2e.slice(0, marker));
			if (mandatedProblem !== null) return `e2e.txt Row 1 ${mandatedProblem}`;
			const row2 = e2e.slice(marker);
			// The run's own exit status, which is the only line here that answers "did this pass"
			// without inferring it from counts. Every version of this rule before it asked the
			// transcript to describe itself, and each was defeated by a transcript that described
			// itself wrongly: an empty splice, a green summary beside forty failures, and a passing
			// count that a test printed to its own stdout. `docs/evidence/README.md` carries the
			// convention, so a folder that ships an e2e.txt ships this line; a folder with none is
			// untouched by this rule.
			//
			// Exactly one, on its own line. `.test(/e2e exit=0/)` asked whether the row contains a
			// success anywhere, and a retry appended beneath an earlier capture inherits that pass: a
			// row ending `e2e exit=1` under an older `e2e exit=0` satisfied it. One run produces one
			// status, so two is a splice that did not replace what it was supposed to, and the rule
			// that exists to stop this row inheriting a result must not itself let it.
			const row2Exit = exitStatusProblem(row2, 'e2e');
			if (row2Exit !== null)
				return `e2e.txt Row 2 ${row2Exit}; the counts beneath it cannot settle what this rule needs the status to answer.`;
			if (lastPassedCount(row2) === null)
				return 'e2e.txt Row 2 has no "<n> passed" line; the transcript was spliced in against a header that did not match, so the run it records cannot be audited.';

			// Playwright's documented default glob is `**/*.@(spec|test).?(c|m)[jt]s?(x)`, so a suite
			// named `page.test.ts` or `.spec.mjs` is ordinary and was being rejected. A proxy built
			// from the one filename this repository happens to use is a rule about this repository.
			//
			// A LOCATION, not a filename, and enough of them to account for the total. The unanchored
			// suffix search asked whether the row mentions a spec file anywhere — which the command
			// line does, and the reproduced config does, and a sentence of prose does. Deleting every
			// per-test line while keeping `41 passed` and one mention of `tests/e2e/smoke.spec.ts` left
			// this rule satisfied and the summary again checkable against nothing. A reporter record
			// cites `file:line:column`; prose cites a file.
			// `[^\s:]` rather than `\S`, so the path cannot run through the colons it is anchored to and
			// then backtrack, and bounded so it cannot run away on a long line.
			const records = row2.match(/[^\s:]{1,200}\.(spec|test)\.[cm]?[jt]sx?:\d{1,6}:\d{1,6}/g) ?? [];
			const passed = lastPassedCount(row2);
			if (records.length < passed)
				return `e2e.txt Row 2 reports ${passed} passed and carries ${records.length} per-test records; a summary with fewer records than passes cannot be checked against the run it claims to describe.`;
			// A row run under a config override has to carry that config. This container cannot launch
			// the browser the mandated command wants, so Row 2 runs under a scratch config that is not
			// in the repository — and for four heads this section described that file instead of
			// showing it, in a sentence that turned out to be false about its own contents. A reviewer
			// cannot check test selection, workers or retries against a file they cannot open, which
			// makes the row's result unauditable however green it is.
			// Every spelling Playwright accepts, not the one this capture happens to use. This pattern
			// has now been widened twice for the same reason. `--config=` alone matched only my own
			// command line, so the documented `--config <file>` and `-c <file>` walked past it. Then
			// requiring a delimiter after `-c` let the ATTACHED form through — `-cpw.local.config.ts`
			// is accepted by the CLI and names a config just as much. The flag ends where the value
			// begins, and nothing separates them, so there is no delimiter to require.
			// `[^\w-]` before the short form, not `\s`. The first attempt required whitespace and its
			// own mutation test passed the `-c` case, because Row 2 names the command inside backticks
			// and a backtick is not whitespace. The delimiter around a flag in prose is punctuation as
			// often as space.
			const NAMES_CONFIG = /--config[=\s]|[^\w-]-c/;
			// indexOf, not a regex. `/```[a-z]*\n[\s\S]{0,20000}defineConfig/` scans a bounded wildcard
			// up to a literal, which backtracks on every fence that is not followed by one —
			// sonarjs/super-linear-regex, caught locally before SonarCloud saw it.
			// A reproduced config is a config that is present, not one that calls a particular helper.
			// Requiring `defineConfig` would reject a valid Playwright config that exports a plain
			// object — the CLI accepts one — so compliant evidence would fail for a style choice.
			// What every config must have is a default export, in one of its two spellings.
			const fence = row2.indexOf('```');
			const fenced = fence === -1 ? '' : row2.slice(fence);
			const reproducesConfig = fenced.includes('export default') || fenced.includes('module.exports');
			if (NAMES_CONFIG.test(row2) && !reproducesConfig)
				return 'e2e.txt Row 2 names a config override but does not reproduce it; the run cannot be audited against a configuration that is not in the evidence.';
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
				// Zero is not a failure here either — Playwright can print `0 flaky`, and the sibling
				// check above was fixed for exactly this while this one was left, again.
				.find((match) => match !== null && match !== undefined && Number(match[1]) > 0);
			if (broken !== undefined)
				return `e2e.txt Row 2 reports "${broken[0].trim()}"; a summary line that also counts passes does not make the run green.`;
			return null;
		}
	},
	{
		name: 'every probe transcript carries its own exit status',
		check: (dir) => {
			// `docs/evidence/README.md` says every transcript records the status of the command that
			// produced it. That sentence was true of the four filenames this guard happened to know
			// and false of the rest, which is a document describing a check that does not exist — the
			// defect this whole run is about, written by me, in the conventions file for the guard.
			const probes = readdirSync(dir).filter((f) => f.startsWith('probe-') && f.endsWith('.txt'));
			for (const file of probes) {
				const untied = notTiedToRun(dir, file);
				if (untied !== null) return `${untied}.`;
				const problem = exitStatusProblem(read(dir, file) ?? '', 'probe');
				if (problem !== null)
					return `${file} ${problem}; a probe transcript with no result cannot show the probe ran.`;
			}
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
			// The COUNT, not just a digit. This pattern read `Tests 0 passed` as a summary and the rule
			// stopped there, so a seam run that executed nothing was certified: `lastPassedCount` had
			// already been taught that zero is not a result, and this rule — which does not use it,
			// because it needs the `Tests` line specifically rather than any `<n> passed` — kept the old
			// reading. That is this run's sibling defect for the sixth time: a fix applied where it was
			// reported and not where the same question is asked. Vitest's `--passWithNoTests` exits 0
			// when discovery finds nothing, so a contract file renamed out of the glob would otherwise
			// ship a green rewind proving that no contract test ran.
			const TESTS_SUMMARY = /^\s{0,8}Tests\s+(\d{1,9}) passed/m;
			const untied = rewinds.map((f) => notTiedToRun(dir, f)).find((entry) => entry !== null);
			if (untied !== undefined) return `${untied}.`;
			const counted = rewinds.map((f) => ({
				file: f,
				passed: TESTS_SUMMARY.exec(stripAnsi(read(dir, f) ?? ''))?.[1]
			}));
			const empty = counted.filter((entry) => entry.passed === undefined).map((e) => e.file);
			if (empty.length > 0)
				return `these rewind transcripts carry no "Tests <n> passed" summary: ${empty.join(', ')}.`;
			const ranNothing = counted.filter((entry) => Number(entry.passed) === 0).map((e) => e.file);
			if (ranNothing.length > 0)
				return `these rewind transcripts report "Tests 0 passed": ${ranNothing.join(', ')}; a seam whose contract tests did not run is not a verified seam, and a runner that passes with no tests exits 0 while proving nothing.`;
			// A seam run that reports "1 failed | 16 passed" has a passing count and is not a pass.
			// Same shape as the end-to-end rule above, and it was missing here for the same reason:
			// the rule asked whether a number was present rather than what the numbers said.
			// Vitest can exit 1 while reporting "Tests 1 passed" and "Errors 1 error" / "Vitest caught
			// 1 unhandled error" — a failure outside any test body, which is the same shape as
			// Playwright's "1 error was not a part of any test" and was missed here for the same reason:
			// the pattern was written from the failures I had seen rather than from how the reporter
			// says a run went wrong.
			// Two patterns rather than one alternation: the combined form measured 21 on Sonar's
			// regex-complexity against a limit of 20, and the honest fix for a regex that is hard to
			// read is fewer branches, not cleverer ones. They are also two different questions — a
			// counted failure, and a crash the reporter attributes to no test.
			// `Test Files` is in the label list because Vitest reports an afterAll failure as
			// `Test Files 1 failed` beside `Tests 1 passed` — the run exits 1 while the line this rule
			// reads says everything passed. It was left out because the labels here were written from
			// the failures I had seen, which is the same reason `Errors` and `Vitest caught` were each
			// missing in turn. `summaryLines` already admits it; only this pattern did not.
			// Through the shared `reportedFailure` now. These two patterns lived here, inline, while the
			// chain transcript and test.txt beside them were checked only for the PRESENCE of a marker
			// — the strictest reading of "did this fail" applied to the seam runs and the loosest to
			// the whole chain.
			const failing = rewinds.filter((f) => reportedFailure(read(dir, f) ?? '') !== null);
			if (failing.length > 0)
				return `these rewind transcripts report failures beside their passes: ${failing.join(', ')}.`;
			// The run's own status, which the probes and the end-to-end row have carried for several
			// rounds and the rewinds did not. `rewind exit=1` beneath a green summary passed every
			// rule: `docs/evidence/README.md` says every transcript records the status of the command
			// that produced it, and this was the last transcript in the folder where that sentence
			// described a check nobody had written.
			//
			// Seventh sibling. The exit-status requirement went onto `verify-outer`, then `e2e`, then
			// lint and build, then the probes — and each time the rewinds sat beside them, being asked
			// only what their counts said.
			//
			// "At least one carries it, and none contradicts it", rather than "every file carries it",
			// because two transcripts here describe the SAME run: `scripts/rewind.mjs` writes its own,
			// named for the seam, and the capture wraps that run and appends the status. The tool
			// cannot append its own exit status — it is the command — so demanding one from every file
			// would reject a folder for containing the chain's own output. Writing this rule the strict
			// way first is how that came out: it failed on committed evidence that is correct.
			const statuses = rewinds.map((file) => {
				const text = stripAnsi(read(dir, file) ?? '');
				return {
					file,
					problem: exitStatusProblem(text, 'rewind'),
					// The reporter's own clock, which is what makes two transcripts one run. The tool's
					// copy and the capture's copy of the same invocation both say `Start at 03:27:51`;
					// a transcript from a different run says something else.
					startedAt: /^\s{0,8}Start at\s+(\S+)/m.exec(text)?.[1] ?? null
				};
			});
			const red = statuses.find(
				(entry) => entry.problem !== null && !entry.problem.startsWith('carries no')
			);
			if (red !== undefined)
				return `${red.file} ${red.problem}; a seam-scoped run's counts describe it, and only its status reports it.`;
			const reported = statuses.filter((entry) => entry.problem === null);
			if (rewinds.length > 0 && reported.length === 0)
				return `no rewind transcript carries a "rewind exit=<code>" line: ${rewinds.join(', ')}; the counts describe these runs and nothing reports them.`;
			// A status-less transcript is only excused by being the SAME run as one that has a status.
			// "At least one carries it" let a second seam's run — or a later, failed one — ride along on
			// a status it had nothing to do with: changing one transcript's `Start at` by an hour left
			// every rule passing while the two files demonstrably described different runs.
			const vouched = new Set(reported.map((entry) => entry.startedAt));
			const borrowed = statuses
				.filter((entry) => entry.problem !== null && !vouched.has(entry.startedAt))
				.map((entry) => `${entry.file} (started ${entry.startedAt ?? 'at no stated time'})`);
			if (borrowed.length > 0)
				return `these rewind transcripts carry no status of their own and match no run that does: ${borrowed.join(', ')}; a run without a result cannot borrow one from a different run.`;
			return null;
		}
	},
	{
		name: 'each chain artifact agrees with itself, and reports success',
		check: (dir) => {
			// Byte counts are not identity. The drift check compares each artifact's length to the
			// length the tape recorded, and a same-length edit is invisible to it: changing one seam's
			// status from "ok" to "no" in chamber-lock.json keeps the file exactly as long, so the tape
			// still matched and every rule passed while a mandatory stage reported a failure.
			//
			// The complete fix is a content digest in the tape, which needs a schema change in
			// proof-tape.mjs and is recorded as follow-up. This is the part that needs nothing: these
			// artifacts each carry a summary AND the detail it summarises, so they can be asked whether
			// they agree with themselves. Editing a status without also editing the count that
			// describes it breaks that agreement — which is this whole run's defect, appearing one last
			// time inside the artifacts themselves.
			// cipher-gate.json states its result in a bare `status` rather than a summary, and nothing
			// read it: setting it to "blocked" and fixing the inventoried byte count left all eight
			// rules passing. The chain does not run `cipher:gate`, so this artifact is the only record
			// that the gate was met — an unread result is the same as no result.
			const cipherProblem = cipherGateProblem(dir, read(dir, 'cipher-gate.json'));
			if (cipherProblem !== null) return cipherProblem;
			// clan-chain states its result as two lists rather than a summary, so the summary-based
			// check below cannot reach it either.
			const chainProblem = clanChainProblem(dir);
			if (chainProblem !== null) return chainProblem;
			// The ledger's Markdown, against the ledger's JSON — the same question asked of the chain's
			// two outputs, and for the same reason: the human-readable half is what a non-coder reads,
			// and it was required to exist without being required to say the same thing.
			const ledgerProblem = seamLedgerSummaryProblem(dir);
			if (ledgerProblem !== null) return ledgerProblem;
			// assumption-alarm states its result as two arrays rather than a summary, so the
			// summary-based check below could not reach it and nothing else looked: filling
			// `invalidAssumptions` while preserving the byte count left every rule passing.
			// `scripts/assumption-alarm.mjs` exits 1 on either array being non-empty, which is the
			// result this reads.
			const alarmProblem = assumptionAlarmProblem(read(dir, 'assumption-alarm.json'));
			if (alarmProblem !== null) return alarmProblem;
			const SUMMARISED = [
				{ file: 'chamber-lock.json', list: 'seams' },
				{ file: 'seam-ledger.json', list: 'seams' },
				{ file: 'shaolin-lint.json', list: 'evidence' }
			];
			for (const { file, list } of SUMMARISED) {
				const problem = selfAgreementProblem(read(dir, file), file, list);
				if (problem !== null) return problem;
			}
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
				{ file: 'lint.txt', name: 'lint', ran: 'npm run lint' },
				{ file: 'build.txt', name: 'build', ran: 'npm run build' }
			];
			for (const { file, name, ran } of REQUIRED) {
				const text = read(dir, file);
				// Absence is not judged here. `npm run verify` writes neither of these, so an ordinary
				// seam change's folder legitimately has no lint.txt — and requiring one turned CI red on
				// compliant evidence. Requiring them for the scheduled routines that DO mandate them means
				// classifying the change, which is the policy-engine work declined in round 32 and
				// recorded as follow-up. What is here must be green; what is absent is somebody else's rule.
				if (text === null) continue;
				// Present and green is not enough: an older passing capture copied into a later run's
				// folder satisfies both. The tape inventories this folder, so it is what ties the file
				// to the run — and nothing was asking it to.
				const untied = notTiedToRun(dir, file);
				if (untied !== null) return `${untied}.`;
				// Deliberately NOT `predatesRun === false` here, though that is what the chain-stage rule
				// requires of chain outputs. `predatesRun` means "older than chamber-lock.json", and the
				// capture order in docs/evidence/README.md requires lint, build, e2e, the probe and the
				// rewinds to be written BEFORE the chain so the tape inventories them at their shipped
				// size. Every one of them is therefore `true` by design, and demanding `false` would
				// have rejected correct evidence — the fourth rule in this file to do that, caught this
				// time by reading the tape instead of assuming what it meant.
				//
				// The inventory entry is the binding on its own: the drift check above compares that
				// entry's size to the committed bytes, so a file the tape lists is a file that existed,
				// at exactly this length, when this run's chain executed. An older capture dropped in
				// afterwards is not inventoried at all, which is what the count above catches.
				const problem = exitStatusProblem(text, name);
				if (problem !== null)
					return `${file} ${problem}; ${ran} either failed or was captured without its result.`;
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
