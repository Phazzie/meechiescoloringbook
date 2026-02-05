// Purpose: Enforce explicit assumptions for blocked probe seams.
// Why: Prevent silent guesses by requiring logged assumptions with validation plans.
// Info flow: docs/seams.md + DECISIONS.md -> assumption checks -> JSON report.
import { promises as fs } from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const ROOT = process.cwd();
const SEAMS_PATH = path.join(ROOT, 'docs', 'seams.md');
const DECISIONS_PATH = path.join(ROOT, 'DECISIONS.md');

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
		const [seam, , probe] = cells;
		seams.push({ seam, probe });
	}
	return seams;
};

const parseAssumptions = (content) => {
	const lines = content.split(/\r?\n/);
	const assumptions = [];
	for (let index = 0; index < lines.length; index += 1) {
		if (lines[index].trim() !== '- Assumption:') {
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
		assumptions.push({
			date: fields.Date ?? '',
			seams: fields.Seams ?? '',
			statement: fields.Statement ?? '',
			validation: fields.Validation ?? '',
			status: fields.Status ?? ''
		});
	}
	return assumptions;
};

const splitSeams = (value) =>
	value
		.split(',')
		.map((entry) => entry.trim())
		.filter((entry) => entry.length > 0);

const ensureEvidenceDir = async (dateFolder) => {
	const evidenceDir = path.join(ROOT, 'docs', 'evidence', dateFolder);
	await fs.mkdir(evidenceDir, { recursive: true });
	return evidenceDir;
};

const run = async () => {
	const seamsContent = await fs.readFile(SEAMS_PATH, 'utf8');
	const decisionsContent = await fs.readFile(DECISIONS_PATH, 'utf8');
	const seams = parseSeams(seamsContent);
	const assumptions = parseAssumptions(decisionsContent);

	const blockedSeams = seams
		.filter((seam) => (seam.probe ?? '').startsWith('TBD'))
		.map((seam) => seam.seam);

	const requiredFields = ['date', 'seams', 'statement', 'validation', 'status'];
	const assumptionChecks = assumptions.map((assumption) => {
		const missingFields = requiredFields.filter((field) => !assumption[field]);
		const seamList = splitSeams(assumption.seams);
		return {
			...assumption,
			seamList,
			missingFields
		};
	});

	const missingAssumptions = blockedSeams.filter((seam) =>
		!assumptionChecks.some((assumption) => assumption.seamList.includes(seam))
	);
	const invalidAssumptions = assumptionChecks.filter((assumption) => assumption.missingFields.length > 0);

	const report = {
		tool: 'assumption-alarm',
		generatedAt: new Date().toISOString(),
		blockedSeams,
		assumptions: assumptionChecks,
		missingSeamCoverage: missingAssumptions,
		invalidAssumptions: invalidAssumptions.map((assumption) => ({
			date: assumption.date,
			missingFields: assumption.missingFields
		}))
	};

	const evidenceDir = await ensureEvidenceDir(toDateFolder(new Date()));
	await fs.writeFile(
		path.join(evidenceDir, 'assumption-alarm.json'),
		`${JSON.stringify(report, null, 2)}\n`,
		'utf8'
	);

	if (missingAssumptions.length > 0 || invalidAssumptions.length > 0) {
		process.stderr.write('Assumption Alarm: missing or incomplete assumptions.\n');
		process.exit(1);
	}
};

run().catch((error) => {
	process.stderr.write(`Assumption Alarm failed: ${error.message}\n`);
	process.exit(1);
});
