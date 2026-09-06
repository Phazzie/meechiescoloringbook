/*
 * Purpose: Prove `scripts/evidence-guard.mjs` still accepts good evidence and still rejects each
 *          defect it was written for.
 * Why: The guard decides whether CI trusts a committed evidence folder, and until this file existed
 *      nothing ran it except CI itself — on folders that only exist when a change happens to ship
 *      evidence. A change to the guard could weaken it, or break it outright, and merge unexercised.
 * Info flow: tests/fixtures/evidence-guard/<date>/ -> temp copy -> one thing broken ->
 *            child `node scripts/evidence-guard.mjs <dir>` -> exit code and message assertions.
 *
 * Invariants:
 *   1. The fixture is a FROZEN COPY under `tests/fixtures/`, and every case works on a copy of it.
 *      Nothing here writes to `docs/evidence/`, and nothing here depends on what the newest run in
 *      that directory happens to contain. Two earlier versions did: one read a folder while the
 *      chain was rewriting it, and one would have broken every `npm test` in the repository the
 *      first time an ordinary run omitted an optional artifact, ran a different seam, or arrived
 *      after the mandated row's waiver expired. `tests/fixtures/evidence-guard/README.md` has the
 *      full account.
 *   2. Every mutation is asserted to have changed the file. A mutation that changes nothing and a
 *      guard that catches nothing produce the same result, and this run has been fooled by that
 *      three times; `mutate` fails loudly rather than silently testing nothing.
 *   3. Both polarities. A rule that only ever fires proves as little as one that never does.
 */
import { spawnSync } from 'node:child_process';
import { cpSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const FIXTURE = 'tests/fixtures/evidence-guard/2026-09-06';

/**
 * A pattern with the reporter's colour codes in it, built WITHOUT a literal escape character.
 *
 * `no-control-regex` rejects an escape inside a regular expression literal, and it caught this file
 * exactly as it caught `scripts/evidence-guard.mjs` on its first run — the same rule, on the test
 * written for the script it first stopped. The codes have to be here at all because these
 * transcripts interleave them with the words, which is what makes a naive replace match nothing.
 */
const ESC = String.fromCharCode(27);
const coloured = (before: string, after: string, flags = ''): RegExp =>
	new RegExp(`${before}${ESC}\\[[0-9;]*m${after}`, flags);

const runGuard = (dir: string) =>
	spawnSync(process.execPath, ['scripts/evidence-guard.mjs', dir], { encoding: 'utf8' });

/**
 * What the guard said while refusing a folder, having first established that it did refuse it.
 *
 * Status alone is a weak assertion: this fixture is one edit away from tripping several rules at
 * once, so a mutation that broke something incidental would look exactly like the rule under test
 * doing its job. Every case below therefore matches the sentence it expects against this, and a rule
 * that stops firing fails here even while some other rule keeps the exit code at 1.
 *
 * The reason is matched in the test body rather than inside this helper so that each case carries a
 * visible assertion of its own — a test whose only assertion is behind a call reads, to a static
 * analyser and to a person skimming, as a test that asserts nothing.
 */
const refusalOf = (dir: string): string => {
	const result = runGuard(dir);
	expect(result.status, `the guard did not refuse ${dir}`).toBe(1);
	return result.stdout + result.stderr;
};

let pristineRoot: string;
let workRoot: string;
let pristine: string;
let workdir: string;

/** A fresh copy of the fixture, so each case starts from known-good evidence. */
const fresh = (): string => {
	rmSync(workdir, { recursive: true, force: true });
	cpSync(pristine, workdir, { recursive: true });
	return workdir;
};

/**
 * Replace bytes in a fixture file and FAIL if nothing changed.
 *
 * These transcripts carry ANSI colour codes between their tokens, so a plain string replace of
 * something that looks contiguous on screen can match nothing at all — which makes the guard's
 * correct silence read as a miss. That happened three times while this guard was being written.
 */
const mutate = (dir: string, file: string, pattern: RegExp, replacement: string): void => {
	const path = join(dir, file);
	const before = readFileSync(path, 'utf8');
	const after = before.replace(pattern, replacement);
	expect(after, `mutation of ${file} changed nothing — the test would prove nothing`).not.toBe(
		before
	);
	writeFileSync(path, after);
	// Never re-derive the file that was just mutated. Both helpers below rewrite a size from what is
	// on disk, so running them over their own target would quietly restore it — and `mutate` would
	// have asserted a change that no longer exists by the time the guard reads the folder, which is
	// invariant 2 of this file defeating itself.
	if (file !== 'proof-tape.json') resize(dir);
	if (file !== 'proof-tape.md') resummarise(dir);
};

/** Keep the proof tape's recorded sizes honest, so the drift rule does not mask the rule under test. */
const resize = (dir: string): void => {
	const path = join(dir, 'proof-tape.json');
	const tape = JSON.parse(readFileSync(path, 'utf8'));
	const walk = (node: unknown): void => {
		if (Array.isArray(node)) return node.forEach(walk);
		if (node === null || typeof node !== 'object') return;
		const entry = node as { name?: unknown; sizeBytes?: unknown };
		if (typeof entry.name === 'string' && typeof entry.sizeBytes === 'number') {
			try {
				entry.sizeBytes = statSync(join(dir, entry.name)).size;
			} catch {
				/* an inventoried file that is not present is its own finding elsewhere */
			}
		}
		Object.values(node).forEach(walk);
	};
	walk(tape);
	writeFileSync(path, JSON.stringify(tape, null, 2));
};

/**
 * Keep the plain-English summary's byte counts honest for the same reason `resize` does.
 *
 * The guard now reads `proof-tape.md` against `proof-tape.json`, and the two are written together by
 * a real run — so a fixture that edits an artifact and updates only the JSON is a folder no chain
 * could produce, and every case here would fail on that instead of on the rule it is testing.
 */
const resummarise = (dir: string): void => {
	const path = join(dir, 'proof-tape.md');
	const summary = readFileSync(path, 'utf8')
		.split('\n')
		.map((line) => {
			const entry = /^- (.+) \(\d{1,12} bytes\)/.exec(line);
			if (entry === null) return line;
			try {
				const size = statSync(join(dir, entry[1])).size;
				return line.replace(/\(\d{1,12} bytes\)/, `(${size} bytes)`);
			} catch {
				return line;
			}
		})
		.join('\n');
	writeFileSync(path, summary);
};

beforeAll(() => {
	// The COPY keeps the fixture folder's name. The guard requires the proof tape's `evidenceDir` to
	// name the directory it sits in — that is the rule that catches an old run replayed under a new
	// date — so a copy in `evidence-guard-work-XXXX/` is, correctly, rejected as a replay. The first
	// version of this test did exactly that and its own baseline failed, which is the rule doing its
	// job to the person writing tests for it.
	//
	// Nothing is neutralised here any more. The fixture is frozen, so the waiver expiry it carries
	// was pushed out once, in the committed bytes, where it can be read rather than reconstructed.
	const named = basename(FIXTURE);
	pristineRoot = mkdtempSync(join(tmpdir(), 'evidence-guard-good-'));
	workRoot = mkdtempSync(join(tmpdir(), 'evidence-guard-work-'));
	pristine = join(pristineRoot, named);
	workdir = join(workRoot, named);
	cpSync(FIXTURE, pristine, { recursive: true });
});

afterAll(() => {
	rmSync(pristineRoot, { recursive: true, force: true });
	rmSync(workRoot, { recursive: true, force: true });
});

describe('evidence-guard', () => {
	it('accepts a folder a real verify chain produced', () => {
		const result = runGuard(fresh());
		expect(result.stdout + result.stderr).toContain('rules pass');
		expect(result.status).toBe(0);
	});

	it('refuses a folder that does not exist, rather than reporting success for nothing', () => {
		expect(refusalOf(join(workRoot, 'no-such-folder'))).toMatch('does not exist');
	});

	it('rejects a chain transcript with no exit status of its own', () => {
		const dir = fresh();
		mutate(dir, 'verify-outer.txt', /verify exit=0/, 'verify finished');
		expect(refusalOf(dir)).toMatch('verify-outer.txt carries the chain exit status');
	});

	it('rejects a chain transcript whose own summary reports a failure', () => {
		const dir = fresh();
		mutate(dir, 'test.txt', coloured('1 (', ')?skipped'), '1 $1failed');
		expect(refusalOf(dir)).toMatch('verify-outer.txt and test.txt agree on the suite total');
	});

	it('accepts a reporter that spells out its zeroes', () => {
		const dir = fresh();
		mutate(dir, 'test.txt', coloured('1 (', ')?skipped'), '0 $1failed | 1 $1skipped');
		expect(runGuard(dir).status).toBe(0);
	});

	it('rejects evidence replayed under a different folder name', () => {
		const dir = fresh();
		const replay = join(workRoot, '2999-01-01');
		rmSync(replay, { recursive: true, force: true });
		cpSync(dir, replay, { recursive: true });
		const result = runGuard(replay);
		rmSync(replay, { recursive: true, force: true });
		expect(result.stdout + result.stderr).toMatch("copy of another run's evidence");
		expect(result.status).toBe(1);
	});

	it('rejects a chain artifact whose summary disagrees with its own detail', () => {
		const dir = fresh();
		mutate(dir, 'chamber-lock.json', /"status": "ok"/, '"status": "no"');
		expect(refusalOf(dir)).toMatch("chamber-lock.json's summary disagrees with its own seams");
	});

	it('rejects a transcript the proof tape does not inventory', () => {
		const dir = fresh();
		const path = join(dir, 'proof-tape.json');
		const tape = JSON.parse(readFileSync(path, 'utf8'));
		const strip = (node: unknown): unknown => {
			if (Array.isArray(node))
				return node
					.filter((item) => !(item && typeof item === 'object' && (item as { name?: string }).name === 'e2e.txt'))
					.map(strip);
			if (node === null || typeof node !== 'object') return node;
			return Object.fromEntries(Object.entries(node).map(([key, value]) => [key, strip(value)]));
		};
		writeFileSync(path, JSON.stringify(strip(tape), null, 2));
		expect(refusalOf(dir)).toMatch('inventory entries for it');
	});

	it('rejects a mandated row whose waiver has expired', () => {
		const dir = fresh();
		mutate(dir, 'e2e.txt', /Waiver-Expires: \d{4}-\d{2}-\d{2}/, 'Waiver-Expires: 2020-01-01');
		expect(refusalOf(dir)).toMatch('carries a waiver that expired on 2020-01-01');
	});

	it('rejects a waiver expiry that is not a real calendar date', () => {
		const dir = fresh();
		mutate(dir, 'e2e.txt', /Waiver-Expires: \d{4}-\d{2}-\d{2}/, 'Waiver-Expires: 9999-99-99');
		expect(refusalOf(dir)).toMatch('which is not a real date');
	});

	it('rejects a run that passed zero tests', () => {
		// `--passWithNoTests` and `--pass-with-no-tests` exit 0 when discovery finds nothing, so a
		// change that switched test discovery off would otherwise ship a certified folder.
		// The count is READ, not typed. Writing `1445` here failed on the very commit that added this
		// file — twelve new tests moved the suite to 1457, the mutation matched nothing, and the
		// `mutate` guard above caught it in CI. That is invariant 2 of the script under test ("no rule
		// hardcodes a count; counts move") broken inside its own test, and it took one commit to bite.
		const dir = fresh();
		const anyTotal = coloured('\\d{1,9} (', ')?passed', 'g');
		mutate(dir, 'test.txt', anyTotal, '0 $1passed');
		mutate(dir, 'verify-outer.txt', anyTotal, '0 $1passed');
		expect(refusalOf(dir)).toMatch('verify-outer.txt and test.txt agree on the suite total');
	});

	it('rejects a rewind whose contract tests did not run', () => {
		// `Tests 0 passed` is what `--passWithNoTests` prints when a rename takes a seam's contract
		// file out of the glob: exit 0, a summary line, and nothing executed. The rule read the digit
		// as evidence that a number was there rather than asking what the number said.
		// Named groups because the replacement puts a digit straight after a reference, and `$10`
		// reads as group 10.
		const dir = fresh();
		const rewindTests = new RegExp(`(?<pre>Tests(?:\\s|${ESC}\\[[0-9;]*m)*)\\d{1,9}(?<post> passed)`);
		mutate(dir, 'rewind-CreationStoreSeam-self-contained.txt', rewindTests, '$<pre>0$<post>');
		expect(refusalOf(dir)).toMatch('report "Tests 0 passed"');
	});

	it('rejects a folder with no plain-English proof summary', () => {
		// The tape writes both of its outputs after taking its inventory, so neither is in it — which
		// made `proof-tape.md` the one mandatory artifact no rule could reach.
		const dir = fresh();
		rmSync(join(dir, 'proof-tape.md'));
		expect(refusalOf(dir)).toMatch('left no artifact: proof-tape.md');
	});

	it('rejects a proof summary that misstates what the report says', () => {
		const dir = fresh();
		mutate(dir, 'proof-tape.md', /\((\d{1,12}) bytes\)/, '(1 bytes)');
		expect(refusalOf(dir)).toMatch('proof-tape.md disagrees with proof-tape.json');
	});

	it('rejects a chain artifact whose counts do not cover every entry', () => {
		// Each count agreeing with the entries it names is not every entry being counted. Moving one
		// seam to a status the summary has no column for, and decrementing the column it left, keeps
		// every column truthful and the file exactly as long — a passing artifact with an unreported
		// failure inside it.
		const dir = fresh();
		mutate(dir, 'chamber-lock.json', /"status": "ok"/, '"status": "no"');
		mutate(dir, 'chamber-lock.json', /"ok": 38/, '"ok": 37');
		expect(refusalOf(dir)).toMatch('in no column at all');
	});

	it('rejects a Cipher Gate whose cited evidence is not confirmed', () => {
		// `null` is the same width as `true`, so the byte count still matches and the top-level status
		// still says ok while the artifact records that it could not confirm a file it cites.
		const dir = fresh();
		mutate(dir, 'cipher-gate.json', /"exists": true/, '"exists": null');
		expect(refusalOf(dir)).toMatch('not confirmed to exist');
	});

	it('rejects a Clan Chain that reports its seams dirty', () => {
		// Swapping the two property names is a same-length edit that inverts the result: 38 clean
		// seams become 38 dirty ones while the ledger and the Markdown beside it still say clean.
		const dir = fresh();
		const path = join(dir, 'clan-chain.json');
		const before = readFileSync(path, 'utf8');
		const after = before
			.replace('"clean":', '"__was_clean":')
			.replace('"dirty":', '"clean":')
			.replace('"__was_clean":', '"dirty":');
		expect(after, 'the clean/dirty swap changed nothing').not.toBe(before);
		writeFileSync(path, after);
		expect(refusalOf(dir)).toMatch('the chain did not come back clean');
	});

	it('rejects a folder dated after today', () => {
		// A folder and a tape can agree with each other about a day that has not happened, and the
		// chain's own stages take the newest dated folder as their input — so a future-dated folder
		// feeds every later run evidence from a run that has not occurred.
		const dir = fresh();
		const future = join(workRoot, '2999-09-06');
		rmSync(future, { recursive: true, force: true });
		cpSync(dir, future, { recursive: true });
		for (const file of ['proof-tape.json', 'proof-tape.md']) {
			const path = join(future, file);
			writeFileSync(path, readFileSync(path, 'utf8').split('2026-09-06').join('2999-09-06'));
		}
		const said = refusalOf(future);
		rmSync(future, { recursive: true, force: true });
		expect(said).toMatch('which is after today');
	});

	it('rejects a rewind whose own exit status reports a failure', () => {
		// The counts describe a run; only the status reports it. Six other transcripts had carried
		// this requirement for several rounds while the rewinds were asked only what their counts said.
		const dir = fresh();
		mutate(dir, 'rewind-CreationStoreSeam-self-contained.txt', /rewind exit=0/, 'rewind exit=1');
		expect(refusalOf(dir)).toMatch('so that run failed');
	});

	it('rejects a Clan Chain naming a seam the ledger has never heard of', () => {
		// Same length, and changed in BOTH chain outputs, so they agree with each other about a seam
		// that does not exist. Comparing list lengths cannot see it; comparing names can.
		const dir = fresh();
		mutate(dir, 'clan-chain.json', /AppConfigSeam/, 'AppBogusXSeam');
		mutate(dir, 'clan-chain.md', /AppConfigSeam/, 'AppBogusXSeam');
		expect(refusalOf(dir)).toMatch('disagree about which seams are clean');
	});

	it('rejects a Cipher Gate citing a file that is not in the tree', () => {
		// `exists: true` is what the gate believed when it ran. Whether the file is here now is a
		// different question, and the only one the committed tree can answer.
		const dir = fresh();
		mutate(dir, 'cipher-gate.json', /scripts\/evidence-guard\.mjs/, 'scripts/evidence-guard.zzz');
		expect(refusalOf(dir)).toMatch('cites files that are not in this tree');
	});

	it('rejects an end-to-end row whose summary outruns its per-test records', () => {
		// Deleting every reporter record while keeping `41 passed` and a mention of a spec file in
		// prose satisfied the old filename search. A record cites file:line:column; prose cites a file.
		const dir = fresh();
		const path = join(dir, 'e2e.txt');
		const kept = readFileSync(path, 'utf8')
			.split('\n')
			.filter((line) => !/\.(spec|test)\.[cm]?[jt]sx?:\d+:\d+/.test(line));
		expect(kept.join('\n'), 'no per-test records were removed').not.toBe(readFileSync(path, 'utf8'));
		writeFileSync(path, kept.join('\n'));
		resize(dir);
		resummarise(dir);
		expect(refusalOf(dir)).toMatch('per-test records');
	});

	it('rejects a mandated row reporting failures beside a successful status', () => {
		const dir = fresh();
		mutate(dir, 'e2e.txt', /e2e-mandated exit=1/, '  41 failed\ne2e-mandated exit=0');
		expect(refusalOf(dir)).toMatch('whose own summary reports failures');
	});

	it('rejects a folder whose tape names a different evidence directory', () => {
		// The basename matches; the path does not. `fake/evidence/2026-09-06` is not this folder.
		const dir = fresh();
		mutate(dir, 'proof-tape.json', /docs\/evidence\//, 'fake/evidence/');
		mutate(dir, 'proof-tape.md', /docs\/evidence\//, 'fake/evidence/');
		expect(refusalOf(dir)).toMatch('the tape was written for a different directory');
	});

	it('rejects a folder with no human-readable seam ledger', () => {
		const dir = fresh();
		rmSync(join(dir, 'seam-ledger.md'));
		expect(refusalOf(dir)).toMatch('left no artifact: seam-ledger.md');
	});

	it('rejects a seam reported ok while one of its own checks failed', () => {
		// The seam status is a rollup of the checks beneath it, and only the rollup was read. `na` is a
		// real status here — 36 of these 38 seams carry one — so the rule is "no check outside ok or
		// na", measured against the artifact rather than assumed.
		const dir = fresh();
		// A NESTED check, not the first `"status": "ok"` in the file — which belongs to the seam and
		// trips the count rule instead. The first version of this test did exactly that and would have
		// credited the new rule with a catch it never made.
		mutate(
			dir,
			'chamber-lock.json',
			/(?<before>"kind": "contract",[^}]{0,300}"status": ")ok/,
			'$<before>no'
		);
		expect(refusalOf(dir)).toMatch('while its contract check reports');
	});

	it('rejects a ledger table cell that disagrees with the ledger JSON', () => {
		// Flipped in the Markdown only: the seam names still match, and the cells are the content.
		const dir = fresh();
		mutate(dir, 'seam-ledger.md', /\| AppConfigSeam \| ✅/, '| AppConfigSeam | ❌');
		expect(refusalOf(dir)).toMatch('disagree cell by cell');
	});

	it('rejects a mandated row that carries a status and no result', () => {
		// `e2e-mandated exit=0` with every line of output deleted reports nothing at all, and "no
		// failure reported" was reading that absence as success.
		const dir = fresh();
		const path = join(dir, 'e2e.txt');
		const [, row2] = readFileSync(path, 'utf8').split('## Row 2');
		writeFileSync(path, `# Row 1 — the mandated command\n\ne2e-mandated exit=0\n\n## Row 2${row2}`);
		resize(dir);
		resummarise(dir);
		expect(refusalOf(dir)).toMatch('no passing result beneath it');
	});

	it('rejects an inventory entry that points outside the folder', () => {
		// Name and size intact, path moved. Every other rule resolves the name against the folder it
		// is reading, so nothing contradicted a path that named somewhere else.
		const dir = fresh();
		mutate(dir, 'proof-tape.json', /"path": "docs\/evidence\//, '"path": "fake/evidence/');
		expect(refusalOf(dir)).toMatch('records files outside the folder it describes');
	});

	it('rejects an artifact whose headline outranks its own counters', () => {
		// `overallStatus: ok` over `1 missing`: every count still matches its entries, so the agreement
		// rule cannot see it — nothing was comparing the headline with the columns beneath it.
		const dir = fresh();
		mutate(dir, 'chamber-lock.json', /"missing": 0/, '"missing": 1');
		expect(refusalOf(dir)).toMatch('while its own summary counts');
	});

	it('rejects a ledger that disagrees with chamber-lock about which seams exist', () => {
		// The ledger and the chain agreeing proves only that they agree. The lock is written by a
		// different stage from a different scan, so it is the independent record.
		const dir = fresh();
		mutate(dir, 'seam-ledger.json', /"seam": "AppConfigSeam"/, '"seam": "AppGhostXSeam"');
		mutate(dir, 'seam-ledger.md', /\| AppConfigSeam \|/, '| AppGhostXSeam |');
		expect(refusalOf(dir)).toMatch('disagree about which seams exist');
	});

	it('rejects a chain artifact stamped on another day', () => {
		// An older lock copied into today's folder before the chain runs is marked current by the tape
		// and passes the "tape no older than lock" comparison. Its own stamp says otherwise.
		const dir = fresh();
		mutate(dir, 'chamber-lock.json', /"generatedAt": "2026-/, '"generatedAt": "2025-');
		expect(refusalOf(dir)).toMatch('stamped on a different day');
	});

	it('rejects a file the tape does not inventory at all', () => {
		// Every other rule asks "does this entry describe a file". This asks the other direction.
		const dir = fresh();
		writeFileSync(join(dir, 'ci-verify.txt'), 'ci exit=1\n');
		expect(refusalOf(dir)).toMatch('in no inventory entry');
	});

	it('rejects an ok check that names a file which is not here', () => {
		// A check records what a scan found; the tree is what is being reviewed. All 192 ok checks in
		// this fixture cite paths that exist, which is what makes requiring it safe — measured before
		// the rule was written, since `na` checks carry prose instead of a path.
		const dir = fresh();
		mutate(dir, 'chamber-lock.json', /app-config-seam\/contract\.ts/, 'app-config-seam/contract.zz');
		expect(refusalOf(dir)).toMatch('while the files they name are not in this tree');
	});

	it('rejects a stage stamped outside the run it claims to be part of', () => {
		// Same day, hours before the chamber lock: the date comparison accepts it, and it is a stale
		// artifact from an earlier run on the same date. The lock opens the run and the tape closes it.
		const dir = fresh();
		mutate(dir, 'seam-ledger.json', /"generatedAt": "2026-09-06T\d\d:/, '"generatedAt": "2026-09-06T00:');
		expect(refusalOf(dir)).toMatch("stamped outside this run's window");
	});

	it('rejects a status-less rewind that belongs to a different run', () => {
		// `scripts/rewind.mjs` writes its own transcript and cannot append an exit status, so a
		// status-less transcript is excused by being the SAME run as one that has a status — both say
		// `Start at 03:27:51`. Changing that by an hour makes it a different run borrowing a result.
		const dir = fresh();
		// Through `coloured`, because the reporter puts its colour codes between "Start at" and the
		// time — a plain pattern matches nothing here, and `mutate` said so rather than letting the
		// case pass against an unmodified file. Fourth time on this branch.
		const startedAt = new RegExp(`(?<pre>Start at\\s{0,8}${ESC}\\[[0-9;]*m\\s{0,8})03:`);
		mutate(dir, 'rewind-CreationStoreSeam(self-contained).txt', startedAt, '$<pre>04:');
		expect(refusalOf(dir)).toMatch('match no run that does');
	});

	it('rejects a Cipher Gate artifact that did not come back ok', () => {
		const dir = fresh();
		mutate(dir, 'cipher-gate.json', /"status": "ok"/, '"status": "blocked"');
		expect(refusalOf(dir)).toMatch('the Cipher Gate did not pass');
	});
});
