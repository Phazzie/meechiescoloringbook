// Purpose: Run verify steps and capture evidence outputs deterministically.
// Why: Automate proof capture for Seam-Driven Development compliance.
// Info flow: npm commands -> evidence files -> review.
import { promises as fs } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { spawnSync } from 'node:child_process';

const ROOT = process.cwd();

const toDateFolder = (date) => date.toISOString().slice(0, 10);

const ensureEvidenceDir = async (dateFolder) => {
	const evidenceDir = path.join(ROOT, 'docs', 'evidence', dateFolder);
	await fs.mkdir(evidenceDir, { recursive: true });
	return evidenceDir;
};

const runCommand = (command, args) => {
	const result = spawnSync(command, args, {
		cwd: ROOT,
		encoding: 'utf8'
	});
	const output = `${result.stdout ?? ''}${result.stderr ?? ''}`;
	process.stdout.write(output);
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
	const testResult = runCommand('npm', ['test']);

	const verifyOutput = `${checkResult.output}\n${testResult.output}`.trim();
	await fs.writeFile(verifyPath, `${verifyHeader}\n${verifyOutput}\n`, 'utf8');
	await fs.writeFile(testPath, `${testHeader}\n${testResult.output.trim()}\n`, 'utf8');

	if (checkResult.status !== 0 || testResult.status !== 0) {
		process.exit(1);
	}
};

run().catch((error) => {
	process.stderr.write(`Verify runner failed: ${error.message}\n`);
	process.exit(1);
});
