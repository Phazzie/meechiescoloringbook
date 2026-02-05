// Purpose: Enforce Seam-Driven Development artifact order for each seam.
// Why: Prevent step skipping by verifying required files exist before work proceeds.
// Info flow: docs/seams.md -> artifact checks -> JSON report + exit code.
import { promises as fs } from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const ROOT = process.cwd();
const SEAMS_PATH = path.join(ROOT, 'docs', 'seams.md');

const toDateFolder = (date) => date.toISOString().slice(0, 10);

const isPlaceholder = (value) =>
	value.startsWith('N/A') || value.startsWith('TBD') || value.length === 0;

const classifyPlaceholder = (value) => {
	if (value.startsWith('N/A')) {
		return 'na';
	}
	if (value.startsWith('TBD')) {
		return 'blocked';
	}
	return 'missing';
};

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

const checkPath = async (label, value, options = {}) => {
	const trimmed = (value ?? '').trim();
	if (isPlaceholder(trimmed)) {
		const status = classifyPlaceholder(trimmed);
		return {
			kind: label,
			path: trimmed,
			status
		};
	}
	const resolved = path.resolve(ROOT, trimmed);
	const exists = await fileExists(resolved);
	if (!exists) {
		return { kind: label, path: trimmed, status: 'missing' };
	}
	if (options.fixtures) {
		const samplePath = path.join(resolved, 'sample.json');
		const faultPath = path.join(resolved, 'fault.json');
		const sampleExists = await fileExists(samplePath);
		const faultExists = await fileExists(faultPath);
		if (!sampleExists || !faultExists) {
			return {
				kind: label,
				path: trimmed,
				status: 'missing',
				missing: [
					!sampleExists ? path.relative(ROOT, samplePath) : null,
					!faultExists ? path.relative(ROOT, faultPath) : null
				].filter(Boolean)
			};
		}
	}
	return { kind: label, path: trimmed, status: 'ok' };
};

const ensureEvidenceDir = async (dateFolder) => {
	const evidenceDir = path.join(ROOT, 'docs', 'evidence', dateFolder);
	await fs.mkdir(evidenceDir, { recursive: true });
	return evidenceDir;
};

const run = async () => {
	const seamContent = await fs.readFile(SEAMS_PATH, 'utf8');
	const seams = parseSeams(seamContent);
	const seamReports = [];
	let missingCount = 0;
	let blockedCount = 0;
	let okCount = 0;

	for (const seam of seams) {
		const checks = [];
		checks.push(await checkPath('contract', seam.contract));
		checks.push(await checkPath('probe', seam.probe));
		checks.push(await checkPath('fixtures', seam.fixtures, { fixtures: true }));
		checks.push(await checkPath('mock', seam.mock));
		checks.push(await checkPath('tests', seam.tests));
		checks.push(await checkPath('adapter', seam.adapter));

		const hasMissing = checks.some((check) => check.status === 'missing');
		const hasBlocked = checks.some((check) => check.status === 'blocked');
		const status = hasMissing ? 'missing' : hasBlocked ? 'blocked' : 'ok';
		if (status === 'missing') {
			missingCount += 1;
		} else if (status === 'blocked') {
			blockedCount += 1;
		} else {
			okCount += 1;
		}
		seamReports.push({
			seam: seam.seam,
			status,
			checks
		});
	}

	const report = {
		tool: 'chamber-lock',
		generatedAt: new Date().toISOString(),
		seams: seamReports,
		summary: {
			ok: okCount,
			blocked: blockedCount,
			missing: missingCount,
			overallStatus: missingCount > 0 ? 'missing' : 'ok'
		}
	};

	const evidenceDir = await ensureEvidenceDir(toDateFolder(new Date()));
	const outputPath = path.join(evidenceDir, 'chamber-lock.json');
	await fs.writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');

	if (missingCount > 0) {
		process.stderr.write('Chamber Lock: missing required seam artifacts.\n');
		process.exit(1);
	}
};

run().catch((error) => {
	process.stderr.write(`Chamber Lock failed: ${error.message}\n`);
	process.exit(1);
});
