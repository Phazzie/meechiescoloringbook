// Purpose: Run a seam's `probe.ts` with the toolchain the repository already installs.
// Why: A probe that cannot be executed is documentation wearing a probe's filename. The obvious
//      command, `npx tsx <probe>`, is not runnable on a clean `npm ci` checkout: `tsx` is not a
//      dependency, so npx reaches for an unpinned download that fails offline or behind a proxy.
//      `esbuild` is already installed (Vite depends on it), so it does the transpiling here and no
//      new dependency is added. It also resolves the directory imports this codebase uses, which
//      `node --experimental-strip-types` does not.
// Info flow: seam name -> esbuild bundle -> temp .mjs -> dynamic import -> probe output on stdout.
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

const listSeamsWithProbes = async () => {
	const entries = await fs.readdir(SEAMS_DIR, { withFileTypes: true });
	const found = [];
	for (const entry of entries) {
		if (!entry.isDirectory()) continue;
		const probePath = path.join(SEAMS_DIR, entry.name, 'probe.ts');
		try {
			await fs.access(probePath);
			found.push(entry.name);
		} catch {
			// A seam without a probe file is chamber-lock's problem, not this script's.
		}
	}
	return found.sort((left, right) => left.localeCompare(right));
};

const fail = (message) => {
	process.stderr.write(`${message}\n`);
	process.exitCode = 1;
};

const seamName = process.argv[2];

if (!seamName || seamName === '--list') {
	const seams = await listSeamsWithProbes();
	process.stdout.write(`Seams with a probe:\n${seams.map((name) => `  ${name}`).join('\n')}\n`);
	if (!seamName) fail('\nUsage: npm run probe -- <seam-name>');
} else {
	const probePath = path.join(SEAMS_DIR, seamName, 'probe.ts');
	try {
		await fs.access(probePath);
	} catch {
		const seams = await listSeamsWithProbes();
		fail(
			`No probe at ${path.relative(ROOT, probePath)}.\n` +
				`Seams with a probe: ${seams.join(', ')}`
		);
	}

	if (process.exitCode !== 1) {
		// Every probe exports `runProbe`, so the runner calls it rather than relying on a
		// self-execution guard. That keeps the probe modules free of any `process` reference, which
		// is what lets them also be imported from a browser console.
		const outDir = await fs.mkdtemp(path.join(os.tmpdir(), 'seam-probe-'));
		const outFile = path.join(outDir, 'probe.ts.mjs');
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
			const probeModule = await import(`file://${outFile}`);
			if (typeof probeModule.runProbe !== 'function') {
				fail(`${seamName}/probe.ts does not export a runProbe() function.`);
			} else {
				const report = await probeModule.runProbe();
				process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
			}
		} finally {
			await fs.rm(outDir, { recursive: true, force: true });
		}
	}
}
