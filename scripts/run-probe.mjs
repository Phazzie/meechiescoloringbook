// Purpose: Run a seam's `probe.ts` with the toolchain the repository already installs.
// Why: A probe that cannot be executed is documentation wearing a probe's filename. The obvious
//      command, `npx tsx <probe>`, is not runnable on a clean `npm ci` checkout: `tsx` is not a
//      dependency, so npx reaches for an unpinned download that fails offline or behind a proxy.
//      `esbuild` is already installed (Vite depends on it), so it does the transpiling here and no
//      new dependency is added. It also resolves the directory imports this codebase uses, which
//      `node --experimental-strip-types` does not.
// Info flow: seam name -> allowlist check -> esbuild bundle -> dynamic import -> report on stdout.
//
// Usage: npm run probe -- <seam-name>        e.g. npm run probe -- clock-seam
//        npm run probe -- --list
import { build } from 'esbuild';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';

const ROOT = process.cwd();
const SEAMS_DIR = path.join(ROOT, 'src', 'lib', 'seams');

/**
 * The seam names that actually have a probe, read from disk.
 *
 * This doubles as the allowlist for the CLI argument. The argument is untrusted input that would
 * otherwise reach `path.join`, where `../../..` escapes the seams directory entirely — so the name
 * is never used to build a path until it has been matched against a directory that really exists
 * here. Matching against a discovered set rather than a character filter means there is no pattern
 * to outsmart.
 */
const listSeamsWithProbes = async () => {
	const entries = await fs.readdir(SEAMS_DIR, { withFileTypes: true });
	const found = [];
	for (const entry of entries) {
		if (!entry.isDirectory()) continue;
		try {
			await fs.access(path.join(SEAMS_DIR, entry.name, 'probe.ts'));
			found.push(entry.name);
		} catch {
			// A seam without a probe file is chamber-lock's problem, not this script's.
		}
	}
	return found.sort((left, right) => left.localeCompare(right));
};

const write = (text) => process.stdout.write(`${text}\n`);

const fail = (message) => {
	process.stderr.write(`${message}\n`);
	process.exitCode = 1;
};

const runProbeForSeam = async (probePath) => {
	const outDir = await fs.mkdtemp(path.join(os.tmpdir(), 'seam-probe-'));
	const outFile = path.join(outDir, 'probe.mjs');
	try {
		await build({
			entryPoints: [probePath],
			outfile: outFile,
			bundle: true,
			platform: 'node',
			format: 'esm',
			target: 'node22',
			logLevel: 'silent'
		});
		// Every probe exports `runProbe`, so the runner calls it rather than relying on a
		// self-execution guard. That keeps the probe modules free of any `process` reference, which
		// is what lets them also be imported from a browser console.
		const probeModule = await import(`file://${outFile}`);
		if (typeof probeModule.runProbe !== 'function') {
			fail(`${path.relative(ROOT, probePath)} does not export a runProbe() function.`);
			return;
		}
		const report = await probeModule.runProbe();
		write(JSON.stringify(report, null, 2));
	} finally {
		await fs.rm(outDir, { recursive: true, force: true });
	}
};

const seams = await listSeamsWithProbes();
const seamList = seams.map((name) => `  ${name}`).join('\n');
const requested = process.argv[2];

if (!requested || requested === '--list') {
	write(`Seams with a probe:\n${seamList}`);
	if (!requested) fail('\nUsage: npm run probe -- <seam-name>');
} else if (!seams.includes(requested)) {
	// Rejected before the name is ever joined into a path.
	fail(`Unknown seam "${requested}".\nSeams with a probe:\n${seamList}`);
} else {
	await runProbeForSeam(path.join(SEAMS_DIR, requested, 'probe.ts'));
}
