// Purpose: Flag seams with missing or blocked artifacts in a simple chain report.
// Why: Make seam readiness visible without interpreting compliance rules.
// Info flow: seam-ledger.json -> chain summary -> JSON/Markdown reports.
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

const getLatestEvidenceDir = async () => {
	if (!(await fileExists(EVIDENCE_ROOT))) {
		return null;
	}
	const entries = await fs.readdir(EVIDENCE_ROOT, { withFileTypes: true });
	const folders = entries
		.filter((entry) => entry.isDirectory())
		.map((entry) => entry.name)
		.sort();
	if (folders.length === 0) {
		return null;
	}
	return path.join(EVIDENCE_ROOT, folders[folders.length - 1]);
};

const run = async () => {
	const evidenceDir = await getLatestEvidenceDir();
	if (!evidenceDir) {
		process.stderr.write('Clan Chain requires an evidence directory.\n');
		process.exit(1);
	}
	const ledgerPath = path.join(evidenceDir, 'seam-ledger.json');
	if (!(await fileExists(ledgerPath))) {
		process.stderr.write('Clan Chain requires seam-ledger.json.\n');
		process.exit(1);
	}
	const ledger = JSON.parse(await fs.readFile(ledgerPath, 'utf8'));
	const seams = Array.isArray(ledger.seams) ? ledger.seams : [];
	const clean = [];
	const dirty = [];
	for (const seam of seams) {
		const status = seam.status ?? 'missing';
		if (status === 'ok') {
			clean.push({ seam: seam.seam, owner: seam.owner ?? '' });
		} else {
			dirty.push({ seam: seam.seam, owner: seam.owner ?? '', status });
		}
	}

	const report = {
		tool: 'clan-chain',
		generatedAt: new Date().toISOString(),
		evidenceDir: path.relative(ROOT, evidenceDir),
		clean,
		dirty
	};

	const outputDir = evidenceDir.includes(toDateFolder(new Date()))
		? evidenceDir
		: path.join(EVIDENCE_ROOT, toDateFolder(new Date()));
	await fs.mkdir(outputDir, { recursive: true });
	await fs.writeFile(
		path.join(outputDir, 'clan-chain.json'),
		`${JSON.stringify(report, null, 2)}\n`,
		'utf8'
	);

	const lines = [
		'<!--',
		'Purpose: Highlight seams that are clean vs blocked/missing.',
		'Why: Keep the seam chain visible for non-coders.',
		'Info flow: seam ledger -> chain summary -> review.',
		'-->',
		'# Clan Chain',
		'',
		`Generated at: ${report.generatedAt}`,
		`Evidence folder: ${report.evidenceDir}`,
		'',
		'Clean seams:'
	];
	for (const seam of clean) {
		lines.push(`- ${seam.seam} (owner: ${seam.owner || 'unassigned'})`);
	}
	lines.push('', 'Dirty seams:');
	for (const seam of dirty) {
		lines.push(
			`- ${seam.seam} (owner: ${seam.owner || 'unassigned'}, status: ${seam.status})`
		);
	}
	lines.push('');
	await fs.writeFile(path.join(outputDir, 'clan-chain.md'), `${lines.join('\n')}\n`, 'utf8');
};

run().catch((error) => {
	process.stderr.write(`Clan Chain failed: ${error.message}\n`);
	process.exit(1);
});
