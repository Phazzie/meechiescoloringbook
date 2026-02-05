// Purpose: Generate a plain-English evidence summary for Seam-Driven Development.
// Why: Make proof artifacts understandable to non-coders without changing enforcement.
// Info flow: evidence folder -> JSON metadata -> Markdown summary.
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

const extractCommands = (content) =>
	content
		.split(/\r?\n/)
		.filter((line) => line.trim().startsWith('> '))
		.map((line) => line.trim().slice(2));

const run = async () => {
	const evidenceDir = (await getLatestEvidenceDir()) ?? (await fs.mkdir(EVIDENCE_ROOT, { recursive: true }).then(() => null));
	if (!evidenceDir) {
		process.stderr.write('Proof Tape requires an evidence directory.\n');
		process.exit(1);
	}
	const entries = await fs.readdir(evidenceDir);
	const files = [];
	for (const entry of entries) {
		const filePath = path.join(evidenceDir, entry);
		const stats = await fs.stat(filePath);
		if (!stats.isFile()) {
			continue;
		}
		const content = await fs.readFile(filePath, 'utf8');
		files.push({
			name: entry,
			path: path.relative(ROOT, filePath),
			sizeBytes: stats.size,
			modifiedAt: stats.mtime.toISOString(),
			commands: extractCommands(content)
		});
	}

	const report = {
		tool: 'proof-tape',
		generatedAt: new Date().toISOString(),
		evidenceDir: path.relative(ROOT, evidenceDir),
		files
	};

	const outputDir = evidenceDir.includes(toDateFolder(new Date()))
		? evidenceDir
		: path.join(EVIDENCE_ROOT, toDateFolder(new Date()));
	await fs.mkdir(outputDir, { recursive: true });
	await fs.writeFile(
		path.join(outputDir, 'proof-tape.json'),
		`${JSON.stringify(report, null, 2)}\n`,
		'utf8'
	);

	const lines = [
		'<!--',
		'Purpose: Summarize evidence artifacts in plain language.',
		'Why: Help non-coders understand proof coverage without reading code.',
		'Info flow: evidence files -> summary -> review.',
		'-->',
		'# Proof Tape',
		'',
		`Generated at: ${report.generatedAt}`,
		`Evidence folder: ${report.evidenceDir}`,
		'',
		'Files included:'
	];
	for (const file of files) {
		lines.push(`- ${file.name} (${file.sizeBytes} bytes)`);
		if (file.commands.length > 0) {
			lines.push(`  Commands: ${file.commands.join(' | ')}`);
		}
	}
	lines.push('');
	await fs.writeFile(path.join(outputDir, 'proof-tape.md'), `${lines.join('\n')}\n`, 'utf8');
};

run().catch((error) => {
	process.stderr.write(`Proof Tape failed: ${error.message}\n`);
	process.exit(1);
});
