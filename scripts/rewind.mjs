// Purpose: Re-run a single seam's contract tests and capture evidence.
// Why: Enable fast, seam-scoped verification without full suite runs.
// Info flow: seam name -> test execution -> evidence file + exit code.
import { promises as fs } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { spawnSync } from 'node:child_process';

const ROOT = process.cwd();
const SEAMS_PATH = path.join(ROOT, 'docs', 'seams.md');

const toDateFolder = (date) => date.toISOString().slice(0, 10);

const parseSeams = (content) => {
	const lines = content.split(/\r?\n/);
	let inCurrent = false;
	let headerSeen = false;
	const seams = [];
	for (const line of lines) {
		if (line.trim().startsWith('## Current seams')) {
			inCurrent = true;
			continue;
		}
		if (!inCurrent) {
			continue;
		}
		if (line.trim() === '' && headerSeen) {
			break;
		}
		if (!line.trim().startsWith('|')) {
			continue;
		}
		const cells = line
			.split('|')
			.slice(1, -1)
			.map((cell) => cell.trim());
		if (cells.length === 0 || cells[0] === 'Seam') {
			headerSeen = true;
			continue;
		}
		if (cells[0].startsWith('---')) {
			continue;
		}
		const [seam, , , , , tests] = cells;
		if (!seam) {
			continue;
		}
		seams.push({ seam, tests });
	}
	return seams;
};

const getSeamName = (args) => {
	const seamIndex = args.findIndex((arg) => arg === '--seam' || arg === '-s');
	if (seamIndex >= 0 && args[seamIndex + 1]) {
		return args[seamIndex + 1];
	}
	return null;
};

const ensureEvidenceDir = async (dateFolder) => {
	const evidenceDir = path.join(ROOT, 'docs', 'evidence', dateFolder);
	await fs.mkdir(evidenceDir, { recursive: true });
	return evidenceDir;
};

const run = async () => {
	const seamName = getSeamName(process.argv.slice(2));
	if (!seamName) {
		process.stderr.write('Rewind requires --seam <SeamName>.\n');
		process.exit(1);
	}
	const seamsContent = await fs.readFile(SEAMS_PATH, 'utf8');
	const seams = parseSeams(seamsContent);
	const seam = seams.find((entry) => entry.seam === seamName);
	if (!seam || !seam.tests) {
		process.stderr.write(`Rewind cannot find tests for seam: ${seamName}.\n`);
		process.exit(1);
	}
	const testPath = path.resolve(ROOT, seam.tests);
	try {
		await fs.access(testPath);
	} catch {
		process.stderr.write(`Rewind missing test file: ${seam.tests}.\n`);
		process.exit(1);
	}

	const result = spawnSync('npx', ['vitest', 'run', seam.tests], {
		cwd: ROOT,
		encoding: 'utf8'
	});
	const output = `${result.stdout ?? ''}${result.stderr ?? ''}`;
	process.stdout.write(output);

	const evidenceDir = await ensureEvidenceDir(toDateFolder(new Date()));
	const evidencePath = path.join(
		evidenceDir,
		`rewind-${seamName.replace(/\s+/g, '')}.txt`
	);
	const header = [
		'# Purpose: Store seam-scoped contract test output for evidence.',
		'# Why: Provide a focused proof trail for the specified seam.',
		'# Info flow: vitest output -> evidence file -> review.',
		''
	].join('\n');
	await fs.writeFile(evidencePath, `${header}\n${output}`, 'utf8');

	process.exit(result.status ?? 1);
};

run().catch((error) => {
	process.stderr.write(`Rewind failed: ${error.message}\n`);
	process.exit(1);
});
