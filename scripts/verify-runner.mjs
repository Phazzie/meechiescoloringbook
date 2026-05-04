// Purpose: Run verify steps and capture evidence outputs deterministically.
// Why: Automate proof capture for Seam-Driven Development compliance.
// Info flow: npm commands -> evidence files -> review.
import { promises as fs } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { spawnSync } from 'node:child_process';
import { sanitizeEvidenceOutput } from './evidence-reporting.mjs';

const ROOT = process.cwd();

const toDateFolder = (date) => date.toISOString().slice(0, 10);

const ensureEvidenceDir = async (dateFolder) => {
	const evidenceDir = path.join(ROOT, 'docs', 'evidence', dateFolder);
	await fs.mkdir(evidenceDir, { recursive: true });
	return evidenceDir;
};

/**
 * @param {string} command
 * @param {string[]} args
 * @returns {{ output: string; status: number }}
 */
const runCommand = (command, args) => {
	const commandLine = [command, ...args].join(' ');
	const executable = process.platform === 'win32' ? process.env.ComSpec || 'cmd.exe' : command;
	const executableArgs =
		process.platform === 'win32' ? ['/d', '/s', '/c', commandLine] : args;
	const result = spawnSync(executable, executableArgs, {
		cwd: ROOT,
		encoding: 'utf8',
		shell: false
	});
	const output = `${result.stdout ?? ''}${result.stderr ?? ''}`;
	process.stdout.write(output);
	if (result.error) {
		const errorOutput = `Command failed to start: ${result.error.message}\n`;
		process.stderr.write(errorOutput);
		return { output: `${output}${errorOutput}`, status: 1 };
	}
	return { output, status: result.status ?? 1 };
};

const run = async () => {
	const evidenceDir = await ensureEvidenceDir(toDateFolder(new Date()));
	const verifyPath = path.join(evidenceDir, 'verify.txt');
	const testPath = path.join(evidenceDir, 'test.txt');

	const verifyHeader = [
		'# Purpose: Store npm run verify output for evidence.',
		'# Why: Provide an audit trail for Seam-Driven Development verification.',
		'# Info flow: Command output -> evidence file -> review.',
		''
	].join('\n');

	const testHeader = [
		'# Purpose: Store npm test output for evidence.',
		'# Why: Provide an audit trail for Seam-Driven Development contract tests.',
		'# Info flow: Command output -> evidence file -> review.',
		''
	].join('\n');

	const checkResult = runCommand('npm', ['run', 'check']);
	const testResult = runCommand('npm', ['test', '--', '--pool=forks', '--maxWorkers=1']);

	const verifyOutput = [
		'$ npm run verify',
		'',
		'$ npm run check',
		checkResult.output,
		'$ npm test -- --pool=forks --maxWorkers=1',
		testResult.output
	].join('\n');
	const sanitizedVerifyOutput = sanitizeEvidenceOutput(ROOT, verifyOutput).trim();
	const sanitizedTestOutput = sanitizeEvidenceOutput(
		ROOT,
		`$ npm test -- --pool=forks --maxWorkers=1\n${testResult.output}`
	).trim();
	await fs.writeFile(verifyPath, `${verifyHeader}\n${sanitizedVerifyOutput}\n`, 'utf8');
	await fs.writeFile(testPath, `${testHeader}\n${sanitizedTestOutput}\n`, 'utf8');

	if (checkResult.status !== 0 || testResult.status !== 0) {
		process.exit(1);
	}
};

run().catch((error) => {
	process.stderr.write(`Verify runner failed: ${error.message}\n`);
	process.exit(1);
});
