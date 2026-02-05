// Purpose: Enforce proof freshness for Seam-Driven Development evidence.
// Why: Prevent declaring completion without recent verify/test evidence.
// Info flow: repo mtimes + evidence files -> JSON report + exit code.
import { promises as fs } from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const ROOT = process.cwd();
const EVIDENCE_ROOT = path.join(ROOT, 'docs', 'evidence');

const toDateFolder = (date) => date.toISOString().slice(0, 10);

const fileExists = async (targetPath) => {
	try {
		await fs.access(targetPath);
		return true;
	} catch {
		return false;
	}
};

const getLatestMtime = async (targetPath) => {
	try {
		const stats = await fs.stat(targetPath);
		if (!stats.isDirectory()) {
			return stats.mtimeMs;
		}
		const entries = await fs.readdir(targetPath);
		let latest = stats.mtimeMs;
		for (const entry of entries) {
			const entryPath = path.join(targetPath, entry);
			const entryLatest = await getLatestMtime(entryPath);
			if (entryLatest > latest) {
				latest = entryLatest;
			}
		}
		return latest;
	} catch {
		return 0;
	}
};

const findLatestEvidence = async (filename) => {
	if (!(await fileExists(EVIDENCE_ROOT))) {
		return null;
	}
	const entries = await fs.readdir(EVIDENCE_ROOT, { withFileTypes: true });
	let latest = null;
	for (const entry of entries) {
		if (!entry.isDirectory()) {
			continue;
		}
		const candidate = path.join(EVIDENCE_ROOT, entry.name, filename);
		if (!(await fileExists(candidate))) {
			continue;
		}
		const stats = await fs.stat(candidate);
		if (!latest || stats.mtimeMs > latest.mtimeMs) {
			latest = { path: candidate, mtimeMs: stats.mtimeMs };
		}
	}
	return latest;
};

const ensureEvidenceDir = async (dateFolder) => {
	const evidenceDir = path.join(EVIDENCE_ROOT, dateFolder);
	await fs.mkdir(evidenceDir, { recursive: true });
	return evidenceDir;
};

const run = async () => {
	const watchPaths = [
		'contracts',
		'fixtures',
		'src/lib/mocks',
		'tests/contract',
		'src/lib/adapters',
		'docs/seams.md',
		'AGENTS.md',
		'scripts',
		'package.json'
	].map((relativePath) => path.join(ROOT, relativePath));

	let latestChange = 0;
	for (const target of watchPaths) {
		const latest = await getLatestMtime(target);
		if (latest > latestChange) {
			latestChange = latest;
		}
	}

	const verifyEvidence = await findLatestEvidence('verify.txt');
	const testEvidence = await findLatestEvidence('test.txt');

	const evidenceChecks = [
		{ name: 'verify', record: verifyEvidence },
		{ name: 'test', record: testEvidence }
	].map((item) => {
		if (!item.record) {
			return { name: item.name, status: 'missing' };
		}
		if (item.record.mtimeMs < latestChange) {
			return {
				name: item.name,
				status: 'stale',
				path: item.record.path,
				mtimeMs: item.record.mtimeMs
			};
		}
		return {
			name: item.name,
			status: 'ok',
			path: item.record.path,
			mtimeMs: item.record.mtimeMs
		};
	});

	const missingCount = evidenceChecks.filter((check) => check.status === 'missing').length;
	const staleCount = evidenceChecks.filter((check) => check.status === 'stale').length;

	const report = {
		tool: 'shaolin-lint',
		generatedAt: new Date().toISOString(),
		latestChangeMs: latestChange,
		evidence: evidenceChecks,
		summary: {
			ok: evidenceChecks.length - missingCount - staleCount,
			missing: missingCount,
			stale: staleCount,
			overallStatus: missingCount > 0 || staleCount > 0 ? 'stale' : 'ok'
		}
	};

	const evidenceDir = await ensureEvidenceDir(toDateFolder(new Date()));
	const outputPath = path.join(evidenceDir, 'shaolin-lint.json');
	await fs.writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');

	if (missingCount > 0 || staleCount > 0) {
		process.stderr.write('Shaolin Lint: evidence missing or stale.\n');
		process.exit(1);
	}
};

run().catch((error) => {
	process.stderr.write(`Shaolin Lint failed: ${error.message}\n`);
	process.exit(1);
});
