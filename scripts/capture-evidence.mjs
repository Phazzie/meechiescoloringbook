// Purpose: Run the full close-out evidence sequence in the required order and capture every result.
// Why: The sequence used to live as a shell block copy-pasted out of plan.md. Four separate reviews
//      found four separate defects in that block (an unquoted `<date>` the shell read as
//      redirection, a truncating `>` that destroyed the required header, a brace group that
//      returned printf's status instead of the command's, and a proof:tape placed before the
//      artifacts it inventories). Each was fixed by editing prose that nobody executed, so the next
//      defect landed the same way. This file is executed instead of transcribed, so it cannot drift
//      from what actually ran.
// Info flow: this script -> docs/evidence/<UTC date>/*.txt|*.md -> review.
import { promises as fs } from 'node:fs';
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
		const shell = process.env.ComSpec || 'cmd.exe';
		return { executable: shell, executableArgs: ['/d', '/s', '/c', ['npm', ...args].join(' ')] };
	}
	return { executable: 'npm', executableArgs: args };
};

// spawnSync's default maxBuffer is 1 MiB. A verbose failure — a vitest run printing every failing
// assertion, a playwright report with traces — passes that easily, and the child is then killed with
// ENOBUFS: exactly the run whose diagnostics matter most is the one that would be truncated, and a
// command that would have succeeded fails instead. Raised well past any plausible run.
const MAX_OUTPUT_BYTES = 64 * 1024 * 1024;

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
	const result = spawnSync(executable, executableArgs, {
		cwd: ROOT,
		encoding: 'utf8',
		shell: false,
		maxBuffer: MAX_OUTPUT_BYTES
	});
	const output = `${result.stdout ?? ''}${result.stderr ?? ''}`;
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

/**
 * Writes an evidence artifact: header first, then the captured output, then the exit status.
 * The header is written by the same call that writes the body, so there is no window in which the
 * file exists without it and no separate step that a reader of this script would not see.
 * @param {string} dir
 * @param {string} name
 * @param {string[]} header
 * @param {string} body
 * @param {number} code
 */
const writeArtifact = async (dir, name, header, body, code) => {
	const text = `${header.map((line) => `# ${line}`).join('\n')}\n#\n${body}\nEXIT=${code}\n`;
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
	// already passed. Re-check, and confirm the tape actually landed where this run's artifacts are.
	assertNoDateRollover(startDate);
	if (!(await fileExists(path.join(dir, 'proof-tape.md')))) {
		process.stderr.write(
			`proof:tape reported success but wrote no proof-tape.md into ${dir}. Its output went to a\n` +
				'different folder, so this run\'s evidence is split and its inventory is incomplete.\n'
		);
		process.exit(1);
	}

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
		const result = npmRun('rewind', ['--seam', seam]);
		rows.push({ seam, code: result.code });
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
			({ seam, code }) => `| \`${seam}\` | ${code} | \`rewind-${seam.replace(/\s+/g, '')}.txt\` |`
		),
		''
	].join('\n');
	await fs.writeFile(path.join(dir, 'seam-rewind-exit-codes.md'), table, 'utf8');
	if (rewindFailed !== 0) {
		process.stderr.write('At least one rewind failed; see seam-rewind-exit-codes.md.\n');
		process.exit(rewindFailed);
	}
};

main().catch((error) => {
	process.stderr.write(`capture-evidence failed: ${error.message}\n`);
	process.exit(1);
});
