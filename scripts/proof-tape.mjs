// Purpose: Generate a plain-English evidence summary for Seam-Driven Development.
// Why: Make proof artifacts understandable to non-coders without changing enforcement.
// Info flow: evidence folder -> JSON metadata -> Markdown summary.
import { promises as fs } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileExists, isEntryPoint, toDateFolder } from './evidence-reporting.mjs';

const ROOT = process.cwd();
const EVIDENCE_ROOT = path.join(ROOT, 'docs', 'evidence');

/**
 * @returns {Promise<string | null>}
 */
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

// chamber-lock.mjs is the first stage of `npm run verify` that writes an artifact
// (audit:gate writes none), so chamber-lock.json's mtime marks the start of the current
// chain. Anything older than it was not produced by this run. Marking against verify.txt
// instead would be wrong in a way worth naming: chamber-lock runs a minute *before*
// verify-runner in the same chain, so it would flag one of the run's own artifacts.
//
// The case this exists for is verify-chain.txt: it is hand-written, nothing regenerates
// it, and it sat in the folder reporting a different test count and start time than the
// verify.txt beside it while the tape listed both without a word — so a reader could not
// tell that the only full-chain transcript described a different run.
//
// Flagged rather than failed. An older artifact is often deliberate — a red proof captured
// earlier in the same session is not wrong — so the useful thing is to say which files
// belong to this run, not to refuse to finish.
/**
 * @typedef {{ name: string, path: string, sizeBytes: number, modifiedAt: string, commands: string[] }} EvidenceFile
 */

/**
 * @template {EvidenceFile} T
 * @param {T[]} files
 * @param {string} [runMarkerName]
 * @returns {(T & { predatesRun: boolean | null })[]}
 */
export const markArtifactsPredatingRun = (files, runMarkerName = 'chamber-lock.json') => {
	const marker = files.find((file) => file.name === runMarkerName);
	const markerTime = marker ? Date.parse(marker.modifiedAt) : Number.NaN;
	if (!Number.isFinite(markerTime)) {
		return files.map((file) => ({ ...file, predatesRun: null }));
	}
	return files.map((file) => {
		const modified = Date.parse(file.modifiedAt);
		return {
			...file,
			predatesRun: Number.isFinite(modified) ? modified < markerTime : null
		};
	});
};

/**
 * @param {string} content
 * @returns {string[]}
 */
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
	/** @type {EvidenceFile[]} */
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

	const markedFiles = markArtifactsPredatingRun(files);
	const predatingRun = markedFiles.filter((file) => file.predatesRun === true);

	const report = {
		tool: 'proof-tape',
		generatedAt: new Date().toISOString(),
		evidenceDir: path.relative(ROOT, evidenceDir),
		runMarker: 'chamber-lock.json',
		filesPredatingRun: predatingRun.map((file) => file.name),
		files: markedFiles
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
	for (const file of markedFiles) {
		const marker = file.predatesRun === true ? ' — PREDATES THIS VERIFY RUN' : '';
		lines.push(`- ${file.name} (${file.sizeBytes} bytes)${marker}`);
		if (file.commands.length > 0) {
			lines.push(`  Commands: ${file.commands.join(' | ')}`);
		}
	}
	if (predatingRun.length > 0) {
		lines.push(
			'',
			`Older than this run's chamber-lock.json: ${predatingRun.map((file) => file.name).join(', ')}.`,
			'These files were written by an earlier run, so they describe a different run than',
			'the one this tape summarizes. Regenerate them or read them as history, not as proof',
			'of the current change.'
		);
	}
	await fs.writeFile(path.join(outputDir, 'proof-tape.md'), `${lines.join('\n')}\n`, 'utf8');
};

// Only run when this file is the entry point, so importing it to unit-test its helpers
// does not regenerate the proof tape as a side effect of the test run.
if (isEntryPoint(import.meta.url)) {
	run().catch((error) => {
		process.stderr.write(`Proof Tape failed: ${error.message}\n`);
		process.exit(1);
	});
}
