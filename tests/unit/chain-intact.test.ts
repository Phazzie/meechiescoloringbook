/*
 * Purpose: Prove `scripts/chain-intact.mjs` accepts this repository's gate and rejects each way of
 *          hollowing it out.
 * Why: That script is what stops a pull request from deciding what "verified" means, and a check
 *      nothing exercises is a check that can rot into always-passing. Its own subject — a script
 *      redefined so it no longer does its job — is exactly what it would become.
 * Info flow: a temp directory holding a package.json -> child `node scripts/chain-intact.mjs` run
 *            with that directory as its cwd -> exit code and message assertions.
 *
 * Invariants:
 *   1. Every case starts from the REAL committed package.json, so a case passes only against the
 *      gate this repository actually has. A hand-written manifest would test the test.
 *   2. Both polarities: the real manifest is accepted, and each mutation is refused for its own
 *      stated reason rather than for any non-zero exit.
 */
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const SCRIPT = resolve('scripts/chain-intact.mjs');
let workdir: string;

/** The committed manifest, with `edit` applied to its scripts, written where the check will read it. */
const manifestWith = (edit: (scripts: Record<string, string>) => void): string => {
	const manifest = JSON.parse(readFileSync('package.json', 'utf8'));
	edit(manifest.scripts);
	writeFileSync(join(workdir, 'package.json'), JSON.stringify(manifest, null, 2));
	return workdir;
};

const run = (dir: string) => spawnSync(process.execPath, [SCRIPT], { cwd: dir, encoding: 'utf8' });

/** What the check said while refusing a manifest, having established that it did refuse it. */
const refusalOf = (dir: string): string => {
	const result = run(dir);
	expect(result.status, 'the gate check accepted a hollowed-out manifest').toBe(1);
	return result.stdout + result.stderr;
};

beforeAll(() => {
	workdir = mkdtempSync(join(tmpdir(), 'chain-intact-'));
});

afterAll(() => {
	rmSync(workdir, { recursive: true, force: true });
});

describe('chain-intact', () => {
	it('accepts the gate this repository commits', () => {
		const result = run(manifestWith(() => {}));
		expect(result.stdout + result.stderr).toContain('runs exactly the');
		expect(result.status).toBe(0);
	});

	it('refuses a verify script replaced outright', () => {
		const dir = manifestWith((scripts) => {
			scripts.verify = 'true';
		});
		expect(refusalOf(dir)).toMatch('is not the chain');
	});

	it('refuses stages turned into echoes of themselves', () => {
		// Every stage name is still present, and a substring check passes on all eight while
		// `npm run verify` prints the names of the stages it no longer runs. A substring is evidence
		// that some text is there, never that a command runs.
		const dir = manifestWith((scripts) => {
			scripts.verify = scripts.verify
				.split(' && ')
				.map((command: string) => `echo ${command}`)
				.join(' && ');
		});
		expect(refusalOf(dir)).toMatch('echo npm run audit:gate');
	});

	it('refuses stages reordered', () => {
		// The proof tape inventories what the stages before it wrote; running it first inventories
		// the previous run's work. Order is part of what the chain is.
		const dir = manifestWith((scripts) => {
			const stages = scripts.verify.split(' && ');
			scripts.verify = [stages[stages.length - 1], ...stages.slice(0, -1)].join(' && ');
		});
		expect(refusalOf(dir)).toMatch('is not the chain');
	});

	it('refuses a chain with one stage dropped', () => {
		const dir = manifestWith((scripts) => {
			scripts.verify = scripts.verify.replace(' && node scripts/proof-tape.mjs', '');
		});
		expect(refusalOf(dir)).toMatch('is not the chain');
	});

	it('refuses a chain whose last stage cannot fail it', () => {
		const dir = manifestWith((scripts) => {
			scripts.verify = `${scripts.verify} || true`;
		});
		expect(refusalOf(dir)).toMatch('is not the chain');
	});

	it('refuses stages separated by semicolons', () => {
		const dir = manifestWith((scripts) => {
			scripts.verify = scripts.verify.split(' && ').join('; ');
		});
		expect(refusalOf(dir)).toMatch('does not stop the');
	});

	it('refuses a test script that no longer runs the suite', () => {
		// The gate runs the unit tests through `verify-runner.mjs`, so redefining `test` takes every
		// test in this repository — including the ones guarding the evidence — out of CI in one line.
		const dir = manifestWith((scripts) => {
			scripts.test = 'echo skipped';
		});
		expect(refusalOf(dir)).toMatch('must be "vitest run"');
	});

	it('refuses an .npmrc that changes what "npm run" executes', () => {
		// `script-shell=/bin/true` leaves package.json untouched and turns the whole chain into a
		// command that exits 0 having run nothing. Measured against this repository: exit 7 becomes
		// exit 0, and the CLI override in the workflow restores it.
		const dir = manifestWith(() => {});
		writeFileSync(join(dir, '.npmrc'), 'script-shell=/bin/true\n');
		const said = refusalOf(dir);
		rmSync(join(dir, '.npmrc'));
		expect(said).toMatch('changes what "npm run" executes');
	});

	it('refuses an .npmrc that preloads code into every stage', () => {
		// `node-options=--require=./preload.cjs` is worse than the shell swap: npm passes it to each
		// script as NODE_OPTIONS, so branch code runs inside every stage. Measured here — exit 7
		// becomes exit 0, clearing NODE_OPTIONS in the environment does NOT help because npm sets it
		// from its own config, and only a CLI `--node-options=` overrides it.
		const dir = manifestWith(() => {});
		writeFileSync(join(dir, '.npmrc'), 'node-options=--require=./preload.cjs\n');
		const said = refusalOf(dir);
		rmSync(join(dir, '.npmrc'));
		expect(said).toMatch('node-options');
	});

	it('accepts an .npmrc that only configures installation', () => {
		// The real file sets `engine-strict`, which has nothing to do with what a script runs. A check
		// that refuses harmless settings teaches people to work around it.
		const dir = manifestWith(() => {});
		writeFileSync(join(dir, '.npmrc'), '# a comment\nengine-strict=true\n');
		const result = run(dir);
		rmSync(join(dir, '.npmrc'));
		expect(result.stdout + result.stderr).toContain('does not change what running them means');
		expect(result.status).toBe(0);
	});

	it('refuses a manifest with no verify script at all', () => {
		const dir = manifestWith((scripts) => {
			delete scripts.verify;
		});
		expect(refusalOf(dir)).toMatch('defines no "verify" script');
	});
});
