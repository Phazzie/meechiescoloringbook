// Purpose: Fail verify when known high/critical dependency vulnerabilities exist.
// Why: npm audit findings were going unnoticed because nothing enforced them.
// Info flow: npm audit --json -> severity counts -> evidence file + exit code.
import { promises as fs } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { spawnSync } from 'node:child_process';

const ROOT = process.cwd();
const FAILING_SEVERITIES = ['high', 'critical'];

const toDateFolder = (date) => date.toISOString().slice(0, 10);

const ensureEvidenceDir = async (dateFolder) => {
	const evidenceDir = path.join(ROOT, 'docs', 'evidence', dateFolder);
	await fs.mkdir(evidenceDir, { recursive: true });
	return evidenceDir;
};

const runNpmAudit = () => {
	const result = spawnSync('npm', ['audit', '--json'], {
		cwd: ROOT,
		encoding: 'utf8',
		shell: false
	});
	if (result.error) {
		throw new Error(`npm audit failed to start: ${result.error.message}`);
	}
	try {
		return JSON.parse(result.stdout || '{}');
	} catch {
		throw new Error(`npm audit produced non-JSON output: ${result.stdout}${result.stderr}`);
	}
};

const run = async () => {
	const report = runNpmAudit();
	const counts = report.metadata?.vulnerabilities ?? {};
	const failingCount = FAILING_SEVERITIES.reduce((sum, severity) => sum + (counts[severity] ?? 0), 0);

	const evidence = {
		tool: 'audit-gate',
		generatedAt: new Date().toISOString(),
		failingSeverities: FAILING_SEVERITIES,
		counts,
		status: failingCount > 0 ? 'blocked' : 'ok'
	};

	const evidenceDir = await ensureEvidenceDir(toDateFolder(new Date()));
	const outputPath = path.join(evidenceDir, 'audit-gate.json');
	await fs.writeFile(outputPath, `${JSON.stringify(evidence, null, 2)}\n`, 'utf8');

	if (failingCount > 0) {
		process.stderr.write(
			`Audit Gate: ${failingCount} high/critical vulnerability(ies) found. Run \`npm audit\` for details.\n`
		);
		process.exit(1);
	}
};

run().catch((error) => {
	process.stderr.write(`Audit Gate failed: ${error.message}\n`);
	process.exit(1);
});
