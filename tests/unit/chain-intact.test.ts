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
		expect(result.stdout + result.stderr).toContain('still invokes all');
		expect(result.status).toBe(0);
	});

	it('refuses a verify script replaced outright', () => {
		const dir = manifestWith((scripts) => {
			scripts.verify = 'true';
		});
		expect(refusalOf(dir)).toMatch('no longer invokes');
	});

	it('refuses a chain with one stage dropped', () => {
		const dir = manifestWith((scripts) => {
			scripts.verify = scripts.verify.replace(' && node scripts/proof-tape.mjs', '');
		});
		expect(refusalOf(dir)).toMatch('node scripts/proof-tape.mjs');
	});

	it('refuses a chain whose stages cannot fail it', () => {
		const dir = manifestWith((scripts) => {
			scripts.verify = `${scripts.verify} || true`;
		});
		expect(refusalOf(dir)).toMatch('cannot fail the chain is not a stage');
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
		expect(refusalOf(dir)).toMatch('no longer invokes vitest');
	});

	it('refuses a manifest with no verify script at all', () => {
		const dir = manifestWith((scripts) => {
			delete scripts.verify;
		});
		expect(refusalOf(dir)).toMatch('defines no "verify" script');
	});
});
