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
const exitStatusProblem = (text, name) => {
	const found = [...stripAnsi(text).matchAll(EXIT_LINE)].filter(([, who]) => who === name);
	if (found.length === 0) return `carries no "${name} exit=<code>" line of its own`;
	if (found.length > 1)
		return `carries ${found.length} "${name} exit=" lines (${found.map(([line]) => line).join(', ')}); one run reports one status, so this was appended to rather than replaced and it no longer says which run it describes`;
	if (found[0][2] !== '0') return `reports "${found[0][0]}", so that run failed`;
	// And it has to be the last thing in the file. "Exactly one, and it is zero" still accepts a
	// retry that was appended and then died before writing its own status: the earlier run's lone
	// `exit=0` stays, a fresh command's output follows it, and the transcript ends mid-run reporting
	// a success that belongs to the run before. A status that does not terminate its transcript is
	// not that transcript's result.
	const lines = stripAnsi(text)
		.split('\n')
		.filter((line) => line.trim() !== '');
	const last = lines[lines.length - 1];
	if (last !== found[0][0])
		return `records "${found[0][0]}" but does not end there — "${last.trim().slice(0, 70)}" follows it, so a later run was captured over it without recording a status of its own`;
	return null;
};

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
			const STAGE_MARKERS = [
				{ pattern: /^> \S{1,80} audit:gate$/m, stage: 'the audit gate' },
				{ pattern: /found \d{1,9}( \w{1,12}){0,2} vulnerabilit/, stage: "the audit gate's result" },
				{ pattern: /svelte-check found/, stage: 'the check stage' },
				{ pattern: /Test Files/, stage: 'the test stage' }
			];
			const missing = STAGE_MARKERS.filter(({ pattern }) => !pattern.test(outer));
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
			if (!/\.spec\.[tj]s/.test(row2))
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
			const fence = row2.indexOf('```');
			const reproducesConfig = fence !== -1 && row2.indexOf('defineConfig', fence) !== -1;
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
			// Two patterns rather than one alternation: the combined form measured 21 on Sonar's
			// regex-complexity against a limit of 20, and the honest fix for a regex that is hard to
			// read is fewer branches, not cleverer ones. They are also two different questions — a
			// counted failure, and a crash the reporter attributes to no test.
			// `Test Files` is in the label list because Vitest reports an afterAll failure as
			// `Test Files 1 failed` beside `Tests 1 passed` — the run exits 1 while the line this rule
			// reads says everything passed. It was left out because the labels here were written from
			// the failures I had seen, which is the same reason `Errors` and `Vitest caught` were each
			// missing in turn. `summaryLines` already admits it; only this pattern did not.
			const COUNTED_FAILURE = /^\s{0,8}(Test Files|Tests|Errors)?\s{0,8}\d{1,9} (failed|errors?)\b/;
			const UNHANDLED = /^\s{0,8}Vitest caught \d{1,9} unhandled error/;
			const failing = rewinds.filter((f) =>
				summaryLines(read(dir, f) ?? '').some(
					(line) => COUNTED_FAILURE.test(line) || UNHANDLED.test(line)
				)
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
