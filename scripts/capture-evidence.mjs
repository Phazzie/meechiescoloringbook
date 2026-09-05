// Purpose: Run the full close-out evidence sequence in the required order and capture every result.
// Why: The sequence used to live as a shell block copy-pasted out of plan.md. Four separate reviews
//      found four separate defects in that block (an unquoted `<date>` the shell read as
//      redirection, a truncating `>` that destroyed the required header, a brace group that
//      returned printf's status instead of the command's, and a proof:tape placed before the
//      artifacts it inventories). Each was fixed by editing prose that nobody executed, so the next
//      defect landed the same way. This file is executed instead of transcribed, so it cannot drift
//      from what actually ran.
// Info flow: this script -> docs/evidence/<UTC date>/*.txt|*.md -> review.
import {
	promises as fs,
	closeSync,
	mkdirSync,
	mkdtempSync,
	openSync,
	readFileSync,
	readdirSync,
	rmSync,
	writeFileSync
} from 'node:fs';
import os from 'node:os';
import { sanitizeEvidenceOutput } from './evidence-reporting.mjs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import process from 'node:process';

/**
 * @param {string} target
 * @returns {Promise<boolean>}
 */
const fileExists = async (target) => {
	try {
		await fs.access(target);
		return true;
	} catch {
		return false;
	}
};

const ROOT = process.cwd();
const EVIDENCE_ROOT = path.join(ROOT, 'docs', 'evidence');

/** The UTC date folder, computed once. See assertNoDateRollover for why once matters. */
const utcDate = () => new Date().toISOString().slice(0, 10);

/**
 * Every seam on the paths `/m/<slug>` reaches — fourteen seams, nineteen rows, because five names
 * appear twice in docs/seams.md (a legacy row and a self-contained row). `npm run rewind` resolves
 * a name by the FIRST exact row match, so the five self-contained ones must carry the suffix or the
 * legacy row is silently verified instead. They are passed as argv entries here rather than through
 * a shell, so the parentheses and spaces need no quoting and cannot be word-split.
 */
const SEAMS = [
	'MeechieToolSeam',
	'SpecValidationSeam',
	'OutputPackagingSeam',
	'CreationStoreSeam',
	'SessionSeam',
	'ClockSeam',
	'PromptAssemblySeam',
	'ImageGenerationSeam',
	'ImageProviderConfigSeam',
	'SafetyPolicySeam',
	'RateLimitSeam',
	'ProviderAdapterSeam',
	'DriftDetectionSeam',
	'MeechieVoiceSeam',
	'MeechieVoiceSeam (self-contained)',
	'DriftDetectionSeam (self-contained)',
	'PromptAssemblySeam (self-contained)',
	'SpecValidationSeam (self-contained)',
	'MeechieToolSeam (self-contained)'
];

/**
 * Resolves how to invoke npm without a PATH lookup.
 *
 * npm sets `npm_node_execpath` and `npm_execpath` to absolute paths when it runs a script, and this
 * script is always started as `npm run evidence:capture`. Spawning `<node> <npm-cli.js>` therefore
 * resolves nothing through PATH — which a writable PATH entry could hijack — and sidesteps the
 * platform problem at the same time: Windows exposes npm as `npm.cmd`, which `spawnSync` cannot
 * start with `shell: false`, but `npm-cli.js` is just a file and node runs it the same everywhere.
 *
 * The fallback covers being run directly as `node scripts/capture-evidence.mjs`, where npm has set
 * nothing. There PATH resolution is unavoidable, so Windows needs the ComSpec route that
 * scripts/verify-runner.mjs:25-27 uses.
 * @param {string[]} args arguments to npm itself, e.g. ['run', 'lint']
 * @returns {{ executable: string, executableArgs: string[] }}
 */
const npmInvocation = (args) => {
	const nodeExecutable = process.env.npm_node_execpath || process.execPath;
	const npmCli = process.env.npm_execpath;
	if (npmCli) {
		return { executable: nodeExecutable, executableArgs: [npmCli, ...args] };
	}
	if (process.platform === 'win32') {
		// Every argument is quoted, because five of the seam names contain spaces and parentheses
		// (`MeechieVoiceSeam (self-contained)`). Joined raw, cmd.exe parses those parentheses as
		// grouping syntax and the name never arrives as one --seam value — and it would fail here,
		// after the chain and the three standalone checks had already run.
		const shell = process.env.ComSpec || 'cmd.exe';
		const quoted = ['npm', ...args].map((arg) => `"${arg.replace(/"/g, '""')}"`).join(' ');
		return { executable: shell, executableArgs: ['/d', '/s', '/c', quoted] };
	}
	return { executable: 'npm', executableArgs: args };
};


/**
 * Runs one of this package's npm scripts and returns its combined output and exit status.
 *
 * Output is preserved even when the spawn reports an error: ENOBUFS sets `error` *and* leaves the
 * output captured up to that point, so discarding it would throw away the diagnostics this tool
 * exists to keep and replace them with a misleading "failed to start" — the mistake
 * scripts/verify-runner.mjs:34-39 already avoids. The status is read from this spawn result and
 * never from a later command's, which is what the shell version of this sequence kept getting wrong.
 *
 * Arguments stay argv entries, so a seam name containing spaces and parentheses cannot be
 * word-split.
 * @param {string} script npm script name, as in package.json
 * @param {string[]} [scriptArgs] arguments forwarded to the script after `--`
 * @returns {{ output: string, code: number }}
 */
const npmRun = (script, scriptArgs = []) => {
	const args = ['run', script, ...(scriptArgs.length > 0 ? ['--', ...scriptArgs] : [])];
	const { executable, executableArgs } = npmInvocation(args);
	// Both descriptors point at ONE file, which buys two things that piping cannot.
	//  - Order. Piping fills two separate buffers and any later join puts every stderr line after all
	//    stdout: canvas warnings emitted mid-run end up below vitest's final summary, and on a failure
	//    the error is detached from the stage that produced it. One file interleaves as it happened.
	//  - No ceiling. A pipe is capped by maxBuffer (1 MiB by default) and the child is killed with
	//    ENOBUFS past it — truncating exactly the verbose failure whose output matters most. A file
	//    has no such limit, so there is no buffer size to tune and get wrong.
	// mkdtemp creates the directory with mode 0700 atomically, so the capture is unreadable by other
	// local accounts for its whole life. It matters because this file holds the child's output BEFORE
	// sanitizeEvidenceOutput strips workstation paths — the raw form is exactly what should not sit
	// world-readable on a shared host. Creating the file alone would inherit the umask (0644 under a
	// standard 022) and there is no atomic way to narrow it afterwards.
	const captureDir = mkdtempSync(path.join(os.tmpdir(), 'capture-evidence-'));
	const capturePath = path.join(captureDir, 'child-output.log');
	const captureFd = openSync(capturePath, 'w', 0o600);
	let result;
	try {
		result = spawnSync(executable, executableArgs, {
			cwd: ROOT,
			shell: false,
			stdio: ['ignore', captureFd, captureFd]
		});
	} finally {
		closeSync(captureFd);
	}
	let output = '';
	// A capture that cannot be read is a failed capture, whatever the child's own status was.
	// Returning the child's zero here would let the sequence finish green having committed an
	// artifact whose entire body is "capture file could not be read" — a green run with no evidence,
	// which is the one outcome this script exists to make impossible.
	let readFailure = null;
	try {
		output = readFileSync(capturePath, 'utf8');
	} catch (error) {
		readFailure = error;
		output = `(capture file could not be read: ${error.message})\n`;
	}
	rmSync(captureDir, { force: true, recursive: true });
	if (result.error) {
		// Kept, not replaced: whatever the child managed to emit is the evidence.
		return { output: `${output}\nnpm run ${script} error: ${result.error.message}\n`, code: 1 };
	}
	if (readFailure) {
		return { output, code: 1 };
	}
	return { output, code: result.status ?? 1 };
};

/**
 * Runs a step and ends the sequence if it failed, so no later step's success can stand in for it.
 * @param {{ output: string, code: number }} result
 * @param {string} what
 */
const exitIfFailed = (result, what) => {
	if (result.code !== 0) {
		process.stderr.write(`${what} failed (exit ${result.code}); stopping.\n`);
		process.exit(result.code);
	}
};

// ANSI escapes are stripped before the repo's path sanitizer runs, and the order matters.
// sanitizeEvidenceOutput replaces the repo root only when followed by end-of-string, a slash or
// whitespace (scripts/evidence-reporting.mjs:35-42). Vitest prints its root wrapped in colour codes
// — `RUN v4.1.0 \x1b[90m<root>\x1b[39m` — and ESC is none of those, so the root survives
// sanitizing. That is why docs/evidence/*/verify.txt and test.txt still contain absolute paths
// today even though verify-runner.mjs does sanitize them. Removing the escapes first closes that
// gap here, and makes the committed .txt readable rather than full of `[1m[46m`.
// Built rather than written as a literal: an ESC in a regex literal trips eslint's no-control-regex,
// and suppressing that rule to keep the terser form would be trading a real check for two characters.
const ESC = String.fromCharCode(27);
const ANSI_ESCAPE = new RegExp(`${ESC}\\[[0-9;]*[A-Za-z]`, 'g');

/**
 * Writes an evidence artifact: header first, then the captured output, then the exit status.
 * The header is written by the same call that writes the body, so there is no window in which the
 * file exists without it and no separate step that a reader of this script would not see.
 *
 * The body is de-escaped and then path-sanitized, so a checkout under `/home/<someone>/...` does not
 * commit that person's directory layout into shared evidence, and the artifact reads the same from
 * any checkout.
 * @param {string} dir
 * @param {string} name
 * @param {string[]} header
 * @param {string} body
 * @param {number} code
 */
const writeArtifact = async (dir, name, header, body, code) => {
	const cleaned = sanitizeEvidenceOutput(ROOT, body.replace(ANSI_ESCAPE, ''));
	const text = `${header.map((line) => `# ${line}`).join('\n')}\n#\n${cleaned}\nEXIT=${code}\n`;
	await fs.writeFile(path.join(dir, name), text, 'utf8');
};

/**
 * The evidence scripts each call `new Date()` independently (scripts/chamber-lock.mjs:173,
 * scripts/verify-runner.mjs:44, and the other generators), so a run straddling midnight UTC splits
 * its artifacts across two dated folders and the final tape inventories only half of them. A run
 * that split silently is worse than one that stops, so this aborts instead.
 * @param {string} startDate
 */
const assertNoDateRollover = (startDate) => {
	const now = utcDate();
	if (now !== startDate) {
		process.stderr.write(
			`UTC date rolled over mid-run (${startDate} -> ${now}). The evidence for this run would be\n` +
				'split across two folders and the final tape would inventory only part of it. Re-run the\n' +
				'whole sequence now that the new day has started.\n'
		);
		process.exit(1);
	}
};

/**
 * Confirms the tape inventoried this run's folder, using the folder it names in its own report.
 * @param {string} dir
 */
const assertTapeCoversThisRun = async (dir) => {
	const reportPath = path.join(dir, 'proof-tape.json');
	if (!(await fileExists(reportPath))) {
		process.stderr.write(`proof:tape reported success but wrote no proof-tape.json into ${dir}.\n`);
		process.exit(1);
	}
	const report = JSON.parse(await fs.readFile(reportPath, 'utf8'));
	const inventoried = path.resolve(ROOT, report.evidenceDir ?? '');
	if (inventoried !== path.resolve(dir)) {
		process.stderr.write(
			`proof:tape inventoried ${report.evidenceDir} but this run's evidence is in ${dir}.\n` +
				'The tape in this folder describes a different one and lists none of this run\'s\n' +
				'captures. Remove or correct the stray dated folder and re-run.\n'
		);
		process.exit(1);
	}
};

/**
 * Refuses to run while another capture is in progress, anywhere.
 *
 * Two overlapping runs write the same fixed filenames, so they overwrite each other's captures — and
 * a rewind deleting an artifact the other run is producing can leave a mixed evidence set that both
 * runs' final checks still accept. Two green commands, one incoherent folder.
 *
 * The lock lives at the evidence ROOT, not inside the dated folder, and that is deliberate: a lock
 * per folder does not exclude a pair of runs straddling midnight UTC. They would take different
 * locks, while the first run's child generators — `rewind.mjs:98`, `proof-tape.mjs:197-199` and the
 * rest — each recompute the date independently and start writing into the *second* run's folder
 * before the first run's own rollover check notices. A single global lock excludes that pair too.
 *
 * `mkdirSync` fails with EEXIST if the lock is already there, which makes claiming it atomic.
 * @returns {string} the lock path, removed when the run ends
 */
const acquireRunLock = () => {
	const lockPath = path.join(EVIDENCE_ROOT, '.capture-evidence.lock');
	const shown = path.relative(ROOT, lockPath);
	const claim = () => {
		mkdirSync(lockPath);
		writeFileSync(path.join(lockPath, 'pid'), String(process.pid), 'utf8');
	};
	try {
		claim();
	} catch (error) {
		if (error.code !== 'EEXIST') {
			throw error;
		}
		// The holder's pid decides whether this lock is live or abandoned. `process.on('exit')` does
		// NOT run on SIGTERM, so a scheduled run killed by a timeout leaves the directory behind — and
		// this routine runs unattended, so "a human should delete it" is not a recovery path: every
		// later invocation would exit EEXIST for ever. A lock whose owner is gone is reclaimed.
		const holder = Number.parseInt(readOwnerPid(lockPath) ?? '', 10);
		if (Number.isInteger(holder) && isProcessAlive(holder)) {
			process.stderr.write(
				`Another capture-evidence run (pid ${holder}) holds ${shown}.\n` +
					'Two runs sharing a dated folder overwrite each other and can leave a mixed evidence\n' +
					'set that still passes every check. Wait for it to finish.\n'
			);
			process.exit(1);
		}
		process.stderr.write(
			`Reclaiming ${shown}: its owner${
				Number.isInteger(holder) ? ` (pid ${holder})` : ''
			} is no longer running, so a previous run was killed before it could clean up.\n`
		);
		rmSync(lockPath, { force: true, recursive: true });
		claim();
	}
	const release = () => rmSync(lockPath, { force: true, recursive: true });
	process.on('exit', release);
	// These handlers only fire in the gaps BETWEEN children, and that is not a caveat — it is most of
	// the reason the pid check above exists. `spawnSync` blocks the event loop, and this script spends
	// nearly all of its wall time inside one, so a signal arriving mid-`npm run verify` cannot be
	// delivered to JS until that child returns. Measured: sending SIGTERM to the node process during
	// the chain leaves the lock directory in place. The handlers still help in the gaps; **the
	// recovery that actually works is the next run finding a dead owner pid and reclaiming.**
	for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP']) {
		process.on(signal, () => {
			release();
			process.exit(signal === 'SIGINT' ? 130 : 143);
		});
	}
	return lockPath;
};

/**
 * @param {string} lockPath
 * @returns {string | null}
 */
const readOwnerPid = (lockPath) => {
	try {
		return readFileSync(path.join(lockPath, 'pid'), 'utf8').trim();
	} catch {
		return null;
	}
};

/**
 * Signal 0 checks for the process without touching it. EPERM means it exists under another user.
 * @param {number} pid
 * @returns {boolean}
 */
const isProcessAlive = (pid) => {
	try {
		process.kill(pid, 0);
		return true;
	} catch (error) {
		return error.code === 'EPERM';
	}
};

/**
 * Deletes every artifact this run is going to produce, before anything runs.
 *
 * Without this, a run that fails EARLY leaves the previous run's successes standing: the chain
 * aborting at the audit gate writes a red `verify-chain-run.txt` and exits, while that day's earlier
 * `verify.txt`, `chamber-lock.json`, `cipher-gate.json` and proof tape all survive — a folder
 * combining this run's failure with machine-readable success from another one. The per-gate deletions
 * further down cannot help, because on that path they are never reached.
 *
 * `verify-chain.txt` is deliberately NOT in this list: it is hand-written before the run rather than
 * produced by it, and the whole ordering depends on it already being there.
 * @param {string} dir
 */
const clearOwnedOutputs = async (dir) => {
	const owned = [
		// written by this script
		'verify-chain-run.txt',
		'lint.txt',
		'build.txt',
		'e2e.txt',
		'seam-rewind-exit-codes.md',
		'cipher-gate-run.txt',
		'proof-tape-run.txt',
		// written by the chain's stages
		'verify.txt',
		'test.txt',
		'chamber-lock.json',
		'shaolin-lint.json',
		'assumption-alarm.json',
		'seam-ledger.json',
		'seam-ledger.md',
		'clan-chain.json',
		'clan-chain.md',
		'proof-tape.json',
		'proof-tape.md',
		// written by the standalone gate
		'cipher-gate.json'
	];
	let existing = [];
	try {
		existing = readdirSync(dir);
	} catch {
		existing = [];
	}
	// rewind.mjs names its own artifacts, and this run's companion captures sit beside them.
	const rewinds = existing.filter((name) => name.startsWith('rewind-') && name.endsWith('.txt'));
	await Promise.all(
		[...owned, ...rewinds].map((name) => fs.rm(path.join(dir, name), { force: true }))
	);
};

const main = async () => {
	const startDate = utcDate();
	const dir = path.join(EVIDENCE_ROOT, startDate);
	// The dated folder is normally created by chamber-lock, the first stage of `npm run verify` —
	// which is to say, after the first thing written here. On the first run of a new UTC day that
	// ordering left nothing to write into.
	await fs.mkdir(dir, { recursive: true });
	acquireRunLock();
	await clearOwnedOutputs(dir);

	await captureChain(dir);
	assertNoDateRollover(startDate);
	await captureStandaloneChecks(dir);
	await captureRewinds(dir, startDate);

	// The standalone gate. Its status is checked before the tape runs: a failing gate followed by a
	// passing tape used to leave the sequence reporting success.
	//
	// Its output is written to an artifact BEFORE the status is propagated, and that order is the
	// point. These two commands used to print to stdout and exit, and npmRun deletes its temporary
	// capture — so a close-out that failed here left no file containing the gate's own output, in a
	// sequence whose entire purpose is retaining what each command said. An unattended run would have
	// had a red exit code and nothing to read.
	// The gate's own artifact is removed first. Without this, a second run the same day whose gate
	// REJECTS leaves the previous run's `cipher-gate.json` — `"status": "ok"` and all — sitting beside
	// this run's red `cipher-gate-run.txt`. The folder would then present machine-readable success for
	// a gate that just failed, which is worse than presenting nothing.
	await fs.rm(path.join(dir, 'cipher-gate.json'), { force: true });
	const cipher = npmRun('cipher:gate');
	process.stdout.write(cipher.output);
	await writeArtifact(
		dir,
		'cipher-gate-run.txt',
		[
			'Purpose: Record `npm run cipher:gate` — its output and its exit status.',
			'Why: cipher:gate is not a stage of the verify chain, and cipher-gate.json is not written',
			'     at all when the gate rejects, so on a failure this is the only record of what it said.',
			'Info flow: npm run cipher:gate -> this file (+ cipher-gate.json when it passes).'
		],
		cipher.output,
		cipher.code
	);
	exitIfFailed(cipher, 'npm run cipher:gate');

	// The tape, last, so its inventory covers every artifact above.
	//
	// proof-tape-run.txt is removed first. It is written *after* the tape, so on a second run the
	// same day the previous one is still present while the tape inventories the folder — and the
	// tape would record its size and mtime, possibly flagging it as predating this run, for a file
	// this run then overwrites. Removing it means the tape cannot report metadata for a file that
	// will not survive the next few lines.
	// Same reasoning as the gate above, plus the tape's own two outputs: a failing tape must not leave
	// the previous run's green `proof-tape.json`/`.md` behind as this run's inventory.
	// `proof-tape-run.txt` additionally has to go because it is written *after* the tape, so a copy
	// left from an earlier run would otherwise be inventoried and then immediately overwritten.
	await fs.rm(path.join(dir, 'proof-tape-run.txt'), { force: true });
	await fs.rm(path.join(dir, 'proof-tape.json'), { force: true });
	await fs.rm(path.join(dir, 'proof-tape.md'), { force: true });
	assertNoDateRollover(startDate);
	const tape = npmRun('proof:tape');
	process.stdout.write(tape.output);
	await writeArtifact(
		dir,
		'proof-tape-run.txt',
		[
			'Purpose: Record `npm run proof:tape` — its output and its exit status.',
			'Why: the tape is the last command in the sequence, so when it fails nothing later can',
			'     report what happened; its own proof-tape.json may not exist to explain it either.',
			'Info flow: npm run proof:tape -> this file (+ proof-tape.json/.md when it succeeds).',
			'Note: written after the tape ran, so the tape does not inventory this file.'
		],
		tape.output,
		tape.code
	);
	exitIfFailed(tape, 'npm run proof:tape');

	// Checking before the spawn is not enough: proof-tape.mjs:197-199 recomputes the date itself, so
	// a tape that *starts* after midnight writes into tomorrow's folder while this run's check has
	// already passed.
	assertNoDateRollover(startDate);
	// And the file being here is not enough either. proof-tape.mjs inventories getLatestEvidenceDir()
	// — the lexicographically last dated folder — but writes its report into *today's*. A folder
	// dated ahead of today (committed by a machine whose clock ran fast) makes it inventory that one
	// and drop this report here, so proof-tape.md would exist in this folder while describing another
	// and listing none of this run's captures. The report names the folder it read; check that.
	await assertTapeCoversThisRun(dir);

	process.stdout.write(`Evidence captured in docs/evidence/${startDate}/\n`);
};

/**
 * Step 1: the chain. Its own stage 8 runs proof:tape, but that copy sees only what exists mid-chain,
 * which is why proof:tape runs again at the end of the sequence.
 * @param {string} dir
 */
const captureChain = async (dir) => {
	const verify = npmRun('verify');
	await writeArtifact(
		dir,
		'verify-chain-run.txt',
		[
			'Purpose: Record the OUTER `npm run verify` command, its output and its exit status.',
			'Why: verify.txt holds only the inner verify-runner stage, and the chain\'s own proof:tape',
			'     overwrites stage 8, so nothing else retains the outer chain result.',
			'Info flow: npm run verify -> this file -> verify-chain.txt points here.'
		],
		verify.output,
		verify.code
	);
	exitIfFailed(verify, 'npm run verify');
};

/**
 * Step 2: the three checks that are not stages of the chain.
 * @param {string} dir
 */
const captureStandaloneChecks = async (dir) => {
	const standalone = [
		{
			name: 'lint.txt',
			script: 'lint',
			header: [
				'Purpose: Record `npm run lint` (eslint) on this head.',
				'Why: lint is not a stage of the verify chain; nothing else captures it.',
				'Info flow: npm run lint -> this file -> verify-chain.txt points here.'
			]
		},
		{
			name: 'build.txt',
			script: 'build',
			header: [
				'Purpose: Record `npm run build` (production build via adapter-vercel) on this head.',
				'Why: build is not a stage of the verify chain; a green test run does not prove the app builds.',
				'Info flow: npm run build -> this file -> verify-chain.txt points here.'
			]
		},
		{
			name: 'e2e.txt',
			script: 'test:e2e',
			header: [
				'Purpose: Record `npm run test:e2e` (playwright) on this head.',
				'Why: e2e is not a stage of the verify chain; the chain runs vitest only.',
				'Info flow: npm run test:e2e -> this file -> verify-chain.txt points here.'
			]
		}
	];
	for (const check of standalone) {
		const result = npmRun(check.script);
		await writeArtifact(dir, check.name, check.header, result.output, result.code);
		exitIfFailed(result, `npm run ${check.script}`);
	}
};

/**
 * Step 3: the rewinds. scripts/rewind.mjs writes each rewind-<Seam>.txt itself, with its own
 * header, so nothing here redirects into those paths — a redirect would clobber the header. It also
 * exits with the seam's status without recording it in the file, so each status is taken from the
 * spawn result. Hand-transcribing them is what made the table unauditable.
 * @param {string} dir
 * @param {string} startDate
 */
const captureRewinds = async (dir, startDate) => {
	const rows = [];
	let rewindFailed = 0;
	for (const seam of SEAMS) {
		const artifact = `rewind-${seam.replace(/\s+/g, '')}.txt`;
		const artifactPath = path.join(dir, artifact);
		// Removed first so that whatever exists afterwards is from *this* run. Without it, a passing
		// artifact left by an earlier run on the same day would satisfy the check below, and a rewind
		// that now fails early would be reported as exit 1 beside an artifact showing a pass.
		await fs.rm(artifactPath, { force: true });
		const result = npmRun('rewind', ['--seam', seam]);
		// rewind.mjs:68-84 exits before writing its artifact when the seam is not in docs/seams.md,
		// has no test path, or its test file is missing — exactly the failures a hard-coded seam list
		// invites. Without this the table would cite an artifact that does not exist and the captured
		// diagnostic would be dropped, leaving only an exit code to explain what went wrong.
		const wroteOwnArtifact = await fileExists(artifactPath);
		if (!wroteOwnArtifact) {
			await writeArtifact(
				dir,
				artifact,
				[
					`Purpose: Record why \`npm run rewind -- --seam ${seam}\` failed.`,
					'Why: rewind.mjs exits before writing its own artifact when it cannot resolve the seam,',
					'     its test path, or its test file, so this run captured the output instead.',
					'Info flow: npm run rewind (failed early) -> capture-evidence.mjs -> this file.'
				],
				result.output,
				result.code
			);
		}
		// An artifact existing is not the same as an artifact being complete. rewind.mjs:88-91 pipes
		// its inner vitest with the DEFAULT 1 MiB maxBuffer, so a verbose failure is killed with
		// ENOBUFS; rewind then writes a *truncated* artifact anyway (:98-109) and reports the spawn
		// error only on stderr. This run's own capture has no such ceiling, so for any failed rewind
		// it is kept beside the artifact rather than dropped because a file happened to be there.
		let companion = null;
		if (result.code !== 0 && wroteOwnArtifact) {
			companion = `rewind-${seam.replace(/\s+/g, '')}-capture.txt`;
			await writeArtifact(
				dir,
				companion,
				[
					`Purpose: This run's full capture of \`npm run rewind -- --seam ${seam}\`, which failed.`,
					'Why: rewind.mjs wrote its own artifact, but its inner vitest spawn uses the default',
					'     1 MiB pipe buffer, so that artifact can be truncated and its spawn error reaches',
					'     stderr only. This capture goes to a file with no size ceiling.',
					`Info flow: npm run rewind -> ${artifact} (rewind's, possibly truncated) + this file.`
				],
				result.output,
				result.code
			);
		}
		rows.push({ seam, code: result.code, artifact, ownArtifact: wroteOwnArtifact, companion });
		if (result.code !== 0) {
			rewindFailed = result.code;
		}
	}
	const table = [
		'<!--',
		'Purpose: Record the exit status of every `npm run rewind` invocation in this run.',
		'Why: scripts/rewind.mjs writes a per-seam artifact but not its exit status, and redirecting',
		'     its stdout would clobber that artifact\'s header. The statuses are collected here',
		'     mechanically, from each spawn result, so the table is command evidence and not a',
		'     hand-entered claim.',
		'Info flow: npm run rewind -> rewind-<Seam>.txt (written by the script) + this table.',
		'Note: Markdown, so the header uses Markdown comment syntax and the file is not mistaken',
		'      for one of the raw rewind-*.txt artifacts.',
		'-->',
		'',
		`# Seam rewind exit codes (${startDate})`,
		'',
		'| Seam (as passed to --seam) | Exit | Artifact |',
		'| --- | --- | --- |',
		...rows.map(
			({ seam, code, artifact, ownArtifact, companion }) =>
				`| \`${seam}\` | ${code} | \`${artifact}\`${
					ownArtifact ? '' : ' (written here: rewind exited before its own)'
				}${companion ? ` + \`${companion}\` (full capture)` : ''} |`
		),
		''
	].join('\n');
	await fs.writeFile(path.join(dir, 'seam-rewind-exit-codes.md'), table, 'utf8');
	if (rewindFailed !== 0) {
		const failed = rows.filter((row) => row.code !== 0);
		process.stderr.write(
			`${failed.length} rewind(s) failed: ${failed.map((row) => row.seam).join(', ')}.\n` +
				`Exit codes in seam-rewind-exit-codes.md; output in ${failed
					.map((row) => row.artifact)
					.join(', ')}.\n`
		);
		process.exit(rewindFailed);
	}
};

main().catch((error) => {
	process.stderr.write(`capture-evidence failed: ${error.message}\n`);
	process.exit(1);
});
