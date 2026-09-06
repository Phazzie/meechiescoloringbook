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
import { join, basename } from 'node:path';
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
	if (status.code === '0') return null;
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
	const entries = Array.isArray(parsed[list]) ? parsed[list] : null;
	if (entries === null)
		return `${file} has no "${list}" list, so its summary cannot be checked against anything.`;
	const disagreements = Object.entries(summary)
		.filter(([, value]) => typeof value === 'number')
		.map(([status, claimed]) => {
			const actual = entries.filter((entry) => entry?.status === status).length;
			return actual === claimed ? null : `${status} (says ${claimed}, ${list} shows ${actual})`;
		})
		.filter((entry) => entry !== null);
	if (disagreements.length === 0) return null;
	return `${file}'s summary disagrees with its own ${list}: ${disagreements.join('; ')}; the file was edited after it was written, or the stage that wrote it is inconsistent.`;
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
	let status;
	try {
		status = JSON.parse(raw).status;
	} catch {
		return 'cipher-gate.json is not readable as JSON, so the gate result cannot be established.';
	}
	if (status === 'ok') return null;
	return `cipher-gate.json reports status "${status}"; the Cipher Gate did not pass, and the verify chain does not run it, so this file is the only place that would say so.`;
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
			inventory.push({ name: node.name, sizeBytes: node.sizeBytes, predatesRun: node.predatesRun });
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
	const named = (value) => basename(value.replace(/\\/g, '/'));
	const here = named(dir);
	const claimed = typeof tape.evidenceDir === 'string' ? named(tape.evidenceDir) : null;
	if (claimed === null)
		return 'proof-tape.json records no evidenceDir, so it cannot be shown to describe this folder rather than another one.';
	if (claimed !== here)
		return `proof-tape.json says it describes "${claimed}" but it is committed in "${here}"; this folder is a copy of another run's evidence, not evidence of this one.`;
	// The run's own clock has to agree with the folder it is filed under. A dated folder names a day;
	// a tape stamped on a different day is a replay filed under a fresh name.
	if (!/^\d{4}-\d{2}-\d{2}$/.test(here)) return null;
	const stamped = typeof tape.generatedAt === 'string' ? tape.generatedAt.slice(0, 10) : null;
	if (stamped !== here)
		return `proof-tape.json is stamped ${stamped ?? '<no generatedAt>'} but filed under ${here}; the run and the folder disagree about when it happened.`;
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
				'clan-chain.json',
				'proof-tape.json'
			];
			const inventory = tapeInventory(dir);
			const absent = CHAIN_ARTIFACTS.filter((name) => read(dir, name) === null);
			if (absent.length > 0)
				return `these chain stages left no artifact: ${absent.join(', ')}; the chain did not run all of them.`;
			// The tape has to be describing THIS folder. It already records `evidenceDir` and
			// `generatedAt`, and nothing here read either, so an entire internally consistent old run
			// could be copied to a new dated path and satisfy every rule below — each artifact
			// genuinely agreeing with the others, all of them from a run that has nothing to do with
			// this change. Copying `2026-09-05` to `2099-01-01` passed all six. The identity was
			// already in the file; the guard simply never asked for it.
			const misfiled = replayedFrom(dir, JSON.parse(read(dir, 'proof-tape.json') ?? '{}'));
			if (misfiled !== null) return misfiled;

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
			if (!/\.(spec|test)\.[cm]?[jt]sx?\b/.test(row2))
				return 'e2e.txt Row 2 has a summary but no per-test lines; the summary cannot be checked against anything.';
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
			const TESTS_SUMMARY = /^\s{0,8}Tests\s+\d{1,9} passed/m;
			const untied = rewinds.map((f) => notTiedToRun(dir, f)).find((entry) => entry !== null);
			if (untied !== undefined) return `${untied}.`;
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
			// assumption-alarm states its result as two arrays rather than a summary, so the
			// summary-based check below could not reach it and nothing else looked: filling
			// `invalidAssumptions` while preserving the byte count left every rule passing.
			// `scripts/assumption-alarm.mjs` exits 1 on either array being non-empty, which is the
			// result this reads.
			const alarmRaw = read(dir, 'assumption-alarm.json');
			if (alarmRaw !== null) {
				let alarm;
				try {
					alarm = JSON.parse(alarmRaw);
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
			}
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
