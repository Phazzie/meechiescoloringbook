// Purpose: Run the whole `verify` chain and write its complete transcript, including the
//          `audit:gate` result and the chain's own exit status, to
//          `docs/evidence/YYYY-MM-DD/verify-outer.txt`.
// Why: `docs/evidence/README.md` makes `verify-outer.txt` the only artifact carrying either of those
//      two facts — `verify.txt` is written by the inner runner and carries neither, despite the
//      name. Nothing in `package.json` or `scripts/` wrote it, so it was captured by hand with a
//      shell redirect, by whoever remembered. Run 23 forgot, and merged a commit with no committed
//      proof that `npm run verify` itself exited 0. An artifact that depends on somebody remembering
//      a redirect is the artifact that goes missing, so the chain writes its own.
// Info flow: `npm run verify` -> this script spawns the chain -> stdout/stderr tee'd to the console
//            and to the dated evidence file -> the child's exit code becomes this process's.
// Invariants:
//   - The transcript is written even when the chain FAILS. A red run is exactly the run whose
//     transcript is worth having, and a script that only records successes is a script that records
//     nothing about the thing it is checking.
//   - The exit code is the child's, unchanged. This wrapper must never be able to turn a failing
//     chain green; if it cannot even spawn, it exits non-zero itself.
//   - Output is streamed to the console as it arrives as well as captured, so the chain looks
//     exactly as it did before this existed.
import { spawn } from 'node:child_process';
import { mkdirSync, createWriteStream } from 'node:fs';
import { join } from 'node:path';

/** The chain itself, exactly as `package.json` used to spell it inline. */
const CHAIN = [
	'npm run audit:gate',
	'node scripts/chamber-lock.mjs',
	'node scripts/verify-runner.mjs',
	'node scripts/shaolin-lint.mjs',
	'node scripts/assumption-alarm.mjs',
	'node scripts/seam-ledger.mjs',
	'node scripts/clan-chain.mjs',
	'node scripts/proof-tape.mjs'
].join(' && ');

// UTC, matching every other dated evidence folder in the repository. A local date would put two
// runs an hour apart into two different folders depending on the machine's timezone.
const today = new Date().toISOString().slice(0, 10);
const dir = join('docs', 'evidence', today);
mkdirSync(dir, { recursive: true });

const path = join(dir, 'verify-outer.txt');
const file = createWriteStream(path);

const started = new Date().toISOString();
file.write(`$ npm run verify\n# started ${started}\n\n`);

const child = spawn(CHAIN, { shell: true });

const tee = (stream, sink) => {
	stream.on('data', (chunk) => {
		sink.write(chunk);
		file.write(chunk);
	});
};

tee(child.stdout, process.stdout);
tee(child.stderr, process.stderr);

const finish = (code) => {
	// The exit status is the whole reason this file exists, so it is written as a line a reader can
	// grep for rather than left to be inferred from the absence of an error above it.
	file.end(`\n# npm run verify exited ${code}\n# finished ${new Date().toISOString()}\n`, () => {
		process.exit(code);
	});
};

child.on('close', (code, signal) => {
	// A signal death has a null code. Reporting it as 0 would write "exited 0" over a chain that was
	// killed, which is the one lie this artifact must never tell.
	finish(code ?? (signal ? 1 : 0));
});

child.on('error', (error) => {
	const message = `\n# could not run the verify chain: ${error.message}\n`;
	process.stderr.write(message);
	file.write(message);
	finish(1);
});
