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

// A probe is runnable through this script only if it exports `runProbe`. Most seams predate that
// convention and their `probe.ts` is prose describing a manual procedure, which is a legitimate
// kind of probe — it just is not one this runner can execute.
const EXPORTS_RUN_PROBE = /export\s+(?:const|function|async\s+function)\s+runProbe\b|export\s*\{[^}]*\brunProbe\b/;

/**
 * Seam names split by whether this script can actually run their probe.
 *
 * `runnable` doubles as the allowlist for the CLI argument. That argument is untrusted input which
 * would otherwise reach `path.join`, where `../../..` escapes the seams directory entirely — so the
 * name is never used to build a path until it has matched a directory discovered here. Matching
 * against a set of real names rather than filtering characters means there is no pattern to
 * outsmart.
 *
 * Listing only what can be executed matters as much: advertising a seam that then exits 1 teaches
 * the reader the command is broken rather than that the probe is manual.
 */
const discoverProbes = async () => {
	const entries = await fs.readdir(SEAMS_DIR, { withFileTypes: true });
	const runnable = [];
	const manual = [];
	for (const entry of entries) {
		if (!entry.isDirectory()) continue;
		const probePath = path.join(SEAMS_DIR, entry.name, 'probe.ts');
		let source;
		try {
			source = await fs.readFile(probePath, 'utf8');
		} catch {
			// A seam without a probe file is chamber-lock's problem, not this script's.
			continue;
		}
		(EXPORTS_RUN_PROBE.test(source) ? runnable : manual).push(entry.name);
	}
	const byName = (left, right) => left.localeCompare(right);
	return { runnable: runnable.sort(byName), manual: manual.sort(byName) };
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

const { runnable, manual } = await discoverProbes();
const indent = (names) => names.map((name) => `  ${name}`).join('\n');
const summary =
	`Runnable probes:\n${indent(runnable)}` +
	(manual.length > 0
		? `\n\nManual probes (documented procedure, no runProbe export):\n${indent(manual)}`
		: '');
const requested = process.argv[2];

if (!requested || requested === '--list') {
	write(summary);
	if (!requested) fail('\nUsage: npm run probe -- <seam-name>');
} else if (!runnable.includes(requested)) {
	// Rejected before the name is ever joined into a path.
	const reason = manual.includes(requested)
		? `"${requested}" has a manual probe: read src/lib/seams/${requested}/probe.ts and follow it.`
		: `Unknown seam "${requested}".`;
	fail(`${reason}\n\n${summary}`);
} else {
	await runProbeForSeam(path.join(SEAMS_DIR, requested, 'probe.ts'));
}
