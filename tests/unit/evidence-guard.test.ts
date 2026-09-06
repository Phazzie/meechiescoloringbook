/*
 * Purpose: Prove `scripts/evidence-guard.mjs` still accepts good evidence and still rejects each
 *          defect it was written for.
 * Why: The guard decides whether CI trusts a committed evidence folder, and until now nothing ran
 *      it except CI itself — on folders that only exist when a change happens to ship evidence. A
 *      change to the guard could weaken it, or break it outright, and merge unexercised. A CI step
 *      that pointed it at "the newest dated folder" was tried first and carried a time bomb: that
 *      folder's mandated-row waiver expires, so a maintenance-only change would have started failing
 *      on a date, for evidence it did not touch.
 * Info flow: newest committed evidence folder -> temp copy, time-dependent parts neutralised ->
 *            child `node scripts/evidence-guard.mjs <dir>` -> exit code and message assertions.
 *
 * Invariants:
 *   1. The fixture is a COPY. Nothing here writes to `docs/evidence/`.
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

const EVIDENCE_ROOT = 'docs/evidence';
const DATED = /(\d{4}-\d{2}-\d{2})$/;

/**
 * The newest dated folder as COMMITTED at HEAD, extracted from git rather than read off disk.
 *
 * The first version of this read the working tree, and it broke the verify chain. `npm test` runs
 * INSIDE `npm run verify`, which rewrites that same folder as it goes — so the fixture was copied
 * mid-rewrite, with some artifacts regenerated and the proof tape not yet, and the guard correctly
 * rejected an inconsistent folder. The test was reading something while it was being written, which
 * is the exact defect this guard exists to catch, committed in the test written for it.
 *
 * Reading from git is not a workaround for that race; it is what this test should always have done.
 * The guard's first invariant is that it judges COMMITTED bytes, so the fixture is the committed
 * bytes, and no concurrently running chain can move them.
 */
const newestCommittedEvidenceDir = (): string => {
	const listed = spawnSync('git', ['ls-tree', '-d', '--name-only', 'HEAD', `${EVIDENCE_ROOT}/`], {
		encoding: 'utf8'
	});
	const dated = listed.stdout
		.split('\n')
		.filter((line) => DATED.test(line.trim()))
		.map((line) => line.trim())
		.sort();
	return dated[dated.length - 1];
};

/** Extract that committed folder into `destRoot`, preserving its path so the name is kept. */
const extractCommitted = (dir: string, destRoot: string): void => {
	const archive = spawnSync('git', ['archive', 'HEAD', dir], {
		encoding: 'buffer',
		maxBuffer: 64 * 1024 * 1024
	});
	const extract = spawnSync('tar', ['-x', '-C', destRoot], { input: archive.stdout });
	if (extract.status !== 0) throw new Error(`could not extract ${dir} from HEAD`);
};

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
 * A folder the guard must refuse, and the reason it must give.
 *
 * Status alone is a weak assertion: this fixture is one edit away from tripping several rules at
 * once, so a mutation that broke something incidental would look exactly like the rule under test
 * doing its job. Every case below therefore names the sentence it expects, and a rule that stops
 * firing is a failure here even while some other rule keeps the exit code at 1.
 */
const expectRefused = (dir: string, because: string | RegExp): void => {
	const result = runGuard(dir);
	const said = result.stdout + result.stderr;
	expect(said, 'the guard refused the folder, but not for the reason under test').toMatch(because);
	expect(result.status).toBe(1);
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
	// The COPY keeps the source folder's name. The guard requires the proof tape's `evidenceDir` to
	// name the directory it sits in — that is the rule that catches an old run replayed under a new
	// date — so a fixture in `evidence-guard-work-XXXX/` is, correctly, rejected as a replay. The
	// first version of this test did exactly that and its own baseline failed, which is the rule
	// doing its job to the person writing tests for it.
	const source = newestCommittedEvidenceDir();
	const named = basename(source);
	pristineRoot = mkdtempSync(join(tmpdir(), 'evidence-guard-good-'));
	workRoot = mkdtempSync(join(tmpdir(), 'evidence-guard-work-'));
	pristine = join(pristineRoot, named);
	workdir = join(workRoot, named);
	// `git archive` writes the full path, so extract into a scratch root and lift the folder up.
	const staging = mkdtempSync(join(tmpdir(), 'evidence-guard-git-'));
	extractCommitted(source, staging);
	cpSync(join(staging, source), pristine, { recursive: true });
	rmSync(staging, { recursive: true, force: true });
	// The mandated Playwright row carries a waiver with an expiry, and the guard compares it to
	// today. Left alone, every assertion here would start failing on that date for reasons that have
	// nothing to do with the guard. The expiry is pushed far out in the COPY only; the committed
	// waiver keeps its real date, which is the whole point of it having one.
	const e2e = join(pristine, 'e2e.txt');
	const text = readFileSync(e2e, 'utf8');
	if (text.includes('Waiver-Expires:')) {
		writeFileSync(e2e, text.replace(/Waiver-Expires: \d{4}-\d{2}-\d{2}/, 'Waiver-Expires: 2999-12-31'));
		resize(pristine);
		resummarise(pristine);
	}
});

afterAll(() => {
	rmSync(pristineRoot, { recursive: true, force: true });
	rmSync(workRoot, { recursive: true, force: true });
});

describe('evidence-guard', () => {
	it('accepts the evidence this repository ships', () => {
		const result = runGuard(fresh());
		expect(result.stdout + result.stderr).toContain('rules pass');
		expect(result.status).toBe(0);
	});

	it('refuses a folder that does not exist, rather than reporting success for nothing', () => {
		expectRefused(join(workRoot, 'no-such-folder'), 'does not exist');
	});

	it('rejects a chain transcript with no exit status of its own', () => {
		const dir = fresh();
		mutate(dir, 'verify-outer.txt', /verify exit=0/, 'verify finished');
		expectRefused(dir, 'verify-outer.txt carries the chain exit status');
	});

	it('rejects a chain transcript whose own summary reports a failure', () => {
		const dir = fresh();
		mutate(dir, 'test.txt', coloured('1 (', ')?skipped'), '1 $1failed');
		expectRefused(dir, 'verify-outer.txt and test.txt agree on the suite total');
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
		expectRefused(dir, "chamber-lock.json's summary disagrees with its own seams");
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
		expectRefused(dir, 'inventory entries for it');
	});

	it('rejects a mandated row whose waiver has expired', () => {
		const dir = fresh();
		mutate(dir, 'e2e.txt', /Waiver-Expires: \d{4}-\d{2}-\d{2}/, 'Waiver-Expires: 2020-01-01');
		expectRefused(dir, 'carries a waiver that expired on 2020-01-01');
	});

	it('rejects a waiver expiry that is not a real calendar date', () => {
		const dir = fresh();
		mutate(dir, 'e2e.txt', /Waiver-Expires: \d{4}-\d{2}-\d{2}/, 'Waiver-Expires: 9999-99-99');
		expectRefused(dir, 'which is not a real date');
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
		expectRefused(dir, 'verify-outer.txt and test.txt agree on the suite total');
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
		expectRefused(dir, 'report "Tests 0 passed"');
	});

	it('rejects a folder with no plain-English proof summary', () => {
		// The tape writes both of its outputs after taking its inventory, so neither is in it — which
		// made `proof-tape.md` the one mandatory artifact no rule could reach.
		const dir = fresh();
		rmSync(join(dir, 'proof-tape.md'));
		expectRefused(dir, 'left no artifact: proof-tape.md');
	});

	it('rejects a proof summary that misstates what the report says', () => {
		const dir = fresh();
		mutate(dir, 'proof-tape.md', /\((\d{1,12}) bytes\)/, '(1 bytes)');
		expectRefused(dir, 'proof-tape.md disagrees with proof-tape.json');
	});

	it('rejects a Cipher Gate artifact that did not come back ok', () => {
		const dir = fresh();
		mutate(dir, 'cipher-gate.json', /"status": "ok"/, '"status": "blocked"');
		expectRefused(dir, 'the Cipher Gate did not pass');
	});
});
