// Purpose: Run the whole `verify` chain and write its complete transcript, including the
//          `audit:gate` result and the chain's own exit status, to
//          `docs/evidence/YYYY-MM-DD/verify-outer.txt`.
// Why: `docs/evidence/README.md` makes `verify-outer.txt` the only artifact carrying either of those
//      two facts — `verify.txt` is written by the inner runner and carries neither, despite the
//      name. Nothing in `package.json` or `scripts/` wrote it, so it was captured by hand with a
//      shell redirect, by whoever remembered. Run 23 forgot, and merged a commit with no committed
//      proof that `npm run verify` itself exited 0. An artifact that depends on somebody remembering
//      a redirect is the artifact that goes missing, so the chain writes its own.
// Info flow: `npm run verify` -> this script runs each chain step in turn -> stdout/stderr tee'd to
//            the console and to the dated evidence file -> the first non-zero exit becomes this
//            process's.
// Invariants:
//   - **No shell.** Each step is spawned as an argv array with `shell: false`, which is the default.
//     The first version of this file passed the whole chain to `spawn` as one `&&`-joined string
//     with `shell: true`; SonarCloud's quality gate failed the pull request on it with a C security
//     rating. The string was a hardcoded constant with no interpolation, so it was not exploitable —
//     but a script that spawns a shell is a shape that becomes exploitable the first time somebody
//     interpolates anything into it, and refusing the shape is cheaper than reviewing every future
//     edit. Running the steps here rather than in `sh` is also strictly better: the transcript can
//     name which step failed, which `&&` cannot.
//   - The transcript is written even when the chain FAILS. A red run is exactly the run whose
//     transcript is worth having, and a script that only records successes records nothing about the
//     thing it is checking.
//   - The exit code is the failing step's, unchanged. This wrapper must never be able to turn a
//     failing chain green; if it cannot even spawn a step, it exits non-zero itself.
//   - Output is streamed to the console as it arrives as well as captured, so the chain looks
//     exactly as it did before this existed.
import { spawn } from 'node:child_process';
import { mkdirSync, createWriteStream } from 'node:fs';
import { join } from 'node:path';

/**
 * The chain, one step per entry, in the order `package.json` used to spell it with `&&`.
 *
 * `npm` is spelled `npm.cmd` on Windows because there is no shell to resolve the extension for us.
 * That is the one thing dropping `shell: true` costs, and it is a two-line cost.
 */
const NPM = process.platform === 'win32' ? 'npm.cmd' : 'npm';

const CHAIN = [
	[NPM, ['run', 'audit:gate']],
	[process.execPath, ['scripts/chamber-lock.mjs']],
	[process.execPath, ['scripts/verify-runner.mjs']],
	[process.execPath, ['scripts/shaolin-lint.mjs']],
	[process.execPath, ['scripts/assumption-alarm.mjs']],
	[process.execPath, ['scripts/seam-ledger.mjs']],
	[process.execPath, ['scripts/clan-chain.mjs']],
	[process.execPath, ['scripts/proof-tape.mjs']]
];

// UTC, matching every other dated evidence folder in the repository. A local date would put two
// runs an hour apart into two different folders depending on the machine's timezone.
const today = new Date().toISOString().slice(0, 10);
const dir = join('docs', 'evidence', today);
mkdirSync(dir, { recursive: true });

const file = createWriteStream(join(dir, 'verify-outer.txt'));

const write = (text) => {
	process.stdout.write(text);
	file.write(text);
};

file.write(`$ npm run verify\n# started ${new Date().toISOString()}\n`);

/** Run one step to completion, resolving with its exit code. Never rejects. */
const runStep = (command, args) =>
	new Promise((resolve) => {
		write(`\n$ ${command} ${args.join(' ')}\n`);
		const child = spawn(command, args);

		const tee = (stream, sink) => {
			stream.on('data', (chunk) => {
				sink.write(chunk);
				file.write(chunk);
			});
		};
		tee(child.stdout, process.stdout);
		tee(child.stderr, process.stderr);

		child.on('error', (error) => {
			const message = `\n# could not run this step: ${error.message}\n`;
			process.stderr.write(message);
			file.write(message);
			resolve(1);
		});
		// A signal death has a null code. Reporting it as 0 would write "exited 0" over a step that
		// was killed, which is the one lie this artifact must never tell.
		child.on('close', (code, signal) => resolve(code ?? (signal ? 1 : 0)));
	});

const run = async () => {
	for (const [command, args] of CHAIN) {
		const code = await runStep(command, args);
		if (code !== 0) return code;
	}
	return 0;
};

const code = await run();

// The exit status is the whole reason this file exists, so it is written as a line a reader can grep
// for rather than left to be inferred from the absence of an error above it.
await new Promise((resolve) => {
	file.end(
		`\n# npm run verify exited ${code}\n# finished ${new Date().toISOString()}\n`,
		resolve
	);
});

process.exit(code);
