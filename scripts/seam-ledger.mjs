// Purpose: Summarize seam artifact coverage for Seam-Driven Development.
// Why: Provide a deterministic ledger of contract/fixture/mock/test/adapter status.
// Info flow: docs/seams.md -> artifact checks -> JSON/Markdown reports.
import { promises as fs } from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const ROOT = process.cwd();
const SEAMS_PATH = path.join(ROOT, 'docs', 'seams.md');

const toDateFolder = (date) => date.toISOString().slice(0, 10);

const fileExists = async (targetPath) => {
	try {
		await fs.access(targetPath);
		return true;
	} catch {
		return false;
	}
};

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
		const [
			seam,
			contract,
			probe,
			fixtures,
			mock,
			tests,
			adapter,
			owner,
			lastProbe,
			notes
		] = cells;
		if (!seam) {
			continue;
		}
		seams.push({
			seam,
			contract,
			probe,
			fixtures,
			mock,
			tests,
			adapter,
			owner,
			lastProbe,
			notes
		});
	}
	return seams;
};

const classifyPath = async (label, value, options = {}) => {
	const trimmed = (value ?? '').trim();
	if (trimmed.startsWith('N/A')) {
		return { kind: label, status: 'na', path: trimmed };
	}
	if (trimmed.startsWith('TBD')) {
		return { kind: label, status: 'blocked', path: trimmed };
	}
	if (trimmed.length === 0) {
		return { kind: label, status: 'missing', path: trimmed };
	}
	const resolved = path.resolve(ROOT, trimmed);
	const exists = await fileExists(resolved);
	if (!exists) {
		return { kind: label, status: 'missing', path: trimmed };
	}
	if (options.fixtures) {
		const samplePath = path.join(resolved, 'sample.json');
		const faultPath = path.join(resolved, 'fault.json');
		const sampleExists = await fileExists(samplePath);
		const faultExists = await fileExists(faultPath);
		if (!sampleExists || !faultExists) {
			return {
				kind: label,
				status: 'missing',
				path: trimmed,
				missing: [
					!sampleExists ? path.relative(ROOT, samplePath) : null,
					!faultExists ? path.relative(ROOT, faultPath) : null
				].filter(Boolean)
			};
		}
	}
	return { kind: label, status: 'ok', path: trimmed };
};

const ensureEvidenceDir = async (dateFolder) => {
	const evidenceDir = path.join(ROOT, 'docs', 'evidence', dateFolder);
	await fs.mkdir(evidenceDir, { recursive: true });
	return evidenceDir;
};

const toStatusEmoji = (status) => {
	switch (status) {
		case 'ok':
			return '✅';
		case 'missing':
			return '❌';
		case 'blocked':
			return '⛔';
		case 'na':
			return '—';
		default:
			return '?';
	}
};

const run = async () => {
	const seamsContent = await fs.readFile(SEAMS_PATH, 'utf8');
	const seams = parseSeams(seamsContent);
	const records = [];
	const summary = { ok: 0, missing: 0, blocked: 0, na: 0 };

	for (const seam of seams) {
		const checks = [];
		checks.push(await classifyPath('contract', seam.contract));
		checks.push(await classifyPath('probe', seam.probe));
		checks.push(await classifyPath('fixtures', seam.fixtures, { fixtures: true }));
		checks.push(await classifyPath('mock', seam.mock));
		checks.push(await classifyPath('tests', seam.tests));
		checks.push(await classifyPath('adapter', seam.adapter));
		const statuses = checks.map((check) => check.status);
		const status = statuses.includes('missing')
			? 'missing'
			: statuses.includes('blocked')
				? 'blocked'
				: statuses.includes('na')
					? 'na'
					: 'ok';
		summary[status] += 1;
		records.push({
			seam: seam.seam,
			owner: seam.owner,
			lastProbe: seam.lastProbe,
			status,
			checks
		});
	}

	const report = {
		tool: 'seam-ledger',
		generatedAt: new Date().toISOString(),
		seams: records,
		summary: {
			...summary,
			overallStatus: summary.missing > 0 ? 'missing' : 'ok'
		}
	};

	const evidenceDir = await ensureEvidenceDir(toDateFolder(new Date()));
	await fs.writeFile(
		path.join(evidenceDir, 'seam-ledger.json'),
		`${JSON.stringify(report, null, 2)}\n`,
		'utf8'
	);

	const tableLines = [
		'| Seam | Status | Contract | Probe | Fixtures | Mock | Tests | Adapter |',
		'| --- | --- | --- | --- | --- | --- | --- | --- |'
	];
	for (const record of records) {
		const byKind = new Map(record.checks.map((check) => [check.kind, check]));
		tableLines.push(
			[record.seam, toStatusEmoji(record.status)]
				.concat(
					['contract', 'probe', 'fixtures', 'mock', 'tests', 'adapter'].map((kind) =>
						toStatusEmoji(byKind.get(kind)?.status ?? 'missing')
					)
				)
				.map((cell) => ` ${cell} `)
				.join('|')
		);
	}
	const md = [
		'<!--',
		'Purpose: Summarize seam artifact coverage for Seam-Driven Development.',
		'Why: Provide a human-readable ledger of seam completeness.',
		'Info flow: seam checks -> ledger table -> review.',
		'-->',
		'# Seam Ledger',
		'',
		`Generated at: ${report.generatedAt}`,
		'',
		...tableLines,
		''
	].join('\n');
	await fs.writeFile(path.join(evidenceDir, 'seam-ledger.md'), `${md}\n`, 'utf8');
};

run().catch((error) => {
	process.stderr.write(`Seam Ledger failed: ${error.message}\n`);
	process.exit(1);
});
