// Purpose: Run the full close-out evidence sequence in the required order and capture every result.
// Why: The sequence used to live as a shell block copy-pasted out of plan.md. Four separate reviews
//      found four separate defects in that block (an unquoted `<date>` the shell read as
//      redirection, a truncating `>` that destroyed the required header, a brace group that
//      returned printf's status instead of the command's, and a proof:tape placed before the
//      artifacts it inventories). Each was fixed by editing prose that nobody executed, so the next
//      defect landed the same way. This file is executed instead of transcribed, so it cannot drift
//      from what actually ran.
// Info flow: this script -> docs/evidence/<UTC date>/*.txt|*.md -> review.
import { promises as fs, closeSync, openSync, readFileSync, rmSync } from 'node:fs';
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
	const capturePath = path.join(os.tmpdir(), `capture-evidence-${process.pid}-${Date.now()}.log`);
	const captureFd = openSync(capturePath, 'w');
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
	try {
		output = readFileSync(capturePath, 'utf8');
	} catch {
		output = '(capture file could not be read)\n';
	}
	rmSync(capturePath, { force: true });
	if (result.error) {
		// Kept, not replaced: whatever the child managed to emit is the evidence.
		return { output: `${output}\nnpm run ${script} error: ${result.error.message}\n`, code: 1 };
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

const main = async () => {
	const startDate = utcDate();
	const dir = path.join(EVIDENCE_ROOT, startDate);
	// The dated folder is normally created by chamber-lock, the first stage of `npm run verify` —
	// which is to say, after the first thing written here. On the first run of a new UTC day that
	// ordering left nothing to write into.
	await fs.mkdir(dir, { recursive: true });

	await captureChain(dir);
	assertNoDateRollover(startDate);
	await captureStandaloneChecks(dir);
	await captureRewinds(dir, startDate);

	// The standalone gate. Its status is checked before the tape runs: a failing gate followed by a
	// passing tape used to leave the sequence reporting success.
	const cipher = npmRun('cipher:gate');
	process.stdout.write(cipher.output);
	exitIfFailed(cipher, 'npm run cipher:gate');

	// The tape, last, so its inventory covers every artifact above.
	assertNoDateRollover(startDate);
	const tape = npmRun('proof:tape');
	process.stdout.write(tape.output);
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
