// Purpose: Enforce a proof-summary cipher entry in DECISIONS for recent seam work.
// Why: Prevent silent drift by requiring a concise, evidence-linked summary.
// Info flow: DECISIONS -> cipher parse -> evidence checks -> JSON report + exit code.
import { promises as fs } from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const ROOT = process.cwd();
const DECISIONS_PATH = path.join(ROOT, 'DECISIONS.md');

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

const parseCipherBlocks = (content) => {
	const lines = content.split(/\r?\n/);
	const blocks = [];
	for (let index = 0; index < lines.length; index += 1) {
		if (lines[index].trim() !== '- Cipher Gate:') {
			continue;
		}
		const fields = {};
		for (let cursor = index + 1; cursor < lines.length; cursor += 1) {
			const line = lines[cursor];
			if (!line.startsWith('  - ')) {
				break;
			}
			const [label, ...rest] = line.replace('  - ', '').split(':');
			fields[label.trim()] = rest.join(':').trim();
		}
		blocks.push({
			date: fields.Date ?? '',
			seams: fields.Seams ?? '',
			evidence: fields.Evidence ?? '',
			summary: fields.Summary ?? '',
			risks: fields.Risks ?? ''
		});
	}
	return blocks;
};

const parseEvidencePaths = (value) =>
	value
		.split(/[,;]+/)
		.map((entry) => entry.trim())
		.filter((entry) => entry.length > 0);

const ensureEvidenceDir = async (dateFolder) => {
	const evidenceDir = path.join(ROOT, 'docs', 'evidence', dateFolder);
	await fs.mkdir(evidenceDir, { recursive: true });
	return evidenceDir;
};

const run = async () => {
	const decisions = await fs.readFile(DECISIONS_PATH, 'utf8');
	const blocks = parseCipherBlocks(decisions);
	if (blocks.length === 0) {
		process.stderr.write('Cipher Gate: missing Cipher Gate entry in DECISIONS.md.\n');
		process.exit(1);
	}
	const sorted = blocks
		.filter((block) => /^\d{4}-\d{2}-\d{2}$/.test(block.date))
		.sort((a, b) => a.date.localeCompare(b.date));
	const latest = sorted[sorted.length - 1];
	if (!latest) {
		process.stderr.write('Cipher Gate: no valid Date field found.\n');
		process.exit(1);
	}
	const requiredFields = ['date', 'seams', 'evidence', 'summary', 'risks'];
	const missingFields = requiredFields.filter((field) => !latest[field]);
	if (missingFields.length > 0) {
		process.stderr.write(`Cipher Gate: missing fields: ${missingFields.join(', ')}.\n`);
		process.exit(1);
	}

	const evidencePaths = parseEvidencePaths(latest.evidence);
	const evidenceChecks = [];
	for (const entry of evidencePaths) {
		const resolved = path.resolve(ROOT, entry);
		const exists = await fileExists(resolved);
		evidenceChecks.push({ path: entry, exists });
	}
	const missingEvidence = evidenceChecks.filter((check) => !check.exists);
	if (missingEvidence.length > 0) {
		process.stderr.write('Cipher Gate: evidence paths missing.\n');
		process.exit(1);
	}

	const watchPaths = [
		'contracts',
		'fixtures',
		'src/lib/mocks',
		'tests/contract',
		'src/lib/adapters',
		'src/routes',
		'AGENTS.md',
		'scripts',
		'package.json'
	].map((relativePath) => path.join(ROOT, relativePath));

	let latestChange = 0;
	for (const target of watchPaths) {
		const latestMtime = await getLatestMtime(target);
		if (latestMtime > latestChange) {
			latestChange = latestMtime;
		}
	}

	const cipherDate = new Date(`${latest.date}T23:59:59Z`).getTime();
	const stale = latestChange > cipherDate;
	if (stale) {
		process.stderr.write('Cipher Gate: cipher entry is older than latest changes.\n');
		process.exit(1);
	}

	const report = {
		tool: 'cipher-gate',
		generatedAt: new Date().toISOString(),
		cipher: {
			date: latest.date,
			seams: latest.seams,
			evidence: evidenceChecks,
			summary: latest.summary,
			risks: latest.risks
		},
		latestChangeMs: latestChange,
		status: 'ok'
	};

	const evidenceDir = await ensureEvidenceDir(toDateFolder(new Date()));
	await fs.writeFile(
		path.join(evidenceDir, 'cipher-gate.json'),
		`${JSON.stringify(report, null, 2)}\n`,
		'utf8'
	);
};

run().catch((error) => {
	process.stderr.write(`Cipher Gate failed: ${error.message}\n`);
	process.exit(1);
});
