// Purpose: Covers shared evidence-reporting helpers for generated proof artifacts.
// Why: Prevent local machine paths and inconsistent seam rollups from entering committed evidence.
// Info flow: helper inputs -> normalized report values -> evidence generator scripts.
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, test } from 'vitest';

import { pathToFileURL } from 'node:url';
import process from 'node:process';

import {
	fileExists,
	isEntryPoint,
	sanitizeEvidenceOutput,
	toDateFolder,
	toMarkdownTableRow,
	toRepoRelativePath,
	toSeamRollupStatus
} from '../../scripts/evidence-reporting.mjs';

describe('evidence reporting helpers', () => {
	test('normalizes evidence paths to repository-relative slash paths', () => {
		const root = path.win32.join(
			'C:\\',
			'Users',
			'ieatc',
			'Meechiescoloringbook'
		);
		const target = path.win32.join(
			root,
			'docs',
			'evidence',
			'2026-05-04',
			'verify.txt'
		);

		expect(toRepoRelativePath(root, target)).toBe(
			'docs/evidence/2026-05-04/verify.txt'
		);
	});

	test('sanitizes local repository roots from captured evidence output', () => {
		const root = path.win32.join(
			'C:\\',
			'Users',
			'ieatc',
			'Meechiescoloringbook'
		);
		const output = [
			`Loading svelte-check in workspace: ${root}`,
			`RUN v3.2.4 ${root.split(/[\\/]+/).join('/')}`
		].join('\n');

		expect(sanitizeEvidenceOutput(root, output)).toBe(
			[
				'Loading svelte-check in workspace: <REPO_ROOT>',
				'RUN v3.2.4 <REPO_ROOT>'
			].join('\n')
		);
	});

	test('does not sanitize repo root text inside relative test paths', () => {
		const output = [
			'RUN v3.2.4 /app',
			'✓ src/lib/seams/app-config-seam/test.ts',
			'✓ tests/unit/app-config-seam.test.ts',
			'✓ /app/src/lib/seams/app-config-seam/test.ts'
		].join('\n');

		expect(sanitizeEvidenceOutput('/app', output)).toBe(
			[
				'RUN v3.2.4 <REPO_ROOT>',
				'✓ src/lib/seams/app-config-seam/test.ts',
				'✓ tests/unit/app-config-seam.test.ts',
				'✓ <REPO_ROOT>/src/lib/seams/app-config-seam/test.ts'
			].join('\n')
		);
	});

	test('rolls up N/A artifact checks as an ok seam when nothing is missing or blocked', () => {
		expect(toSeamRollupStatus(['ok', 'na', 'ok'])).toBe('ok');
		expect(toSeamRollupStatus(['na'])).toBe('ok');
	});

	test('prioritizes missing and blocked seam statuses over ok artifacts', () => {
		expect(toSeamRollupStatus(['ok', 'blocked', 'na'])).toBe('blocked');
		expect(toSeamRollupStatus(['ok', 'missing', 'blocked'])).toBe('missing');
	});

	test('renders markdown table rows with leading and trailing pipes', () => {
		expect(toMarkdownTableRow(['PromptCompilerSeam', 'ok', 'na'])).toBe(
			'| PromptCompilerSeam | ok | na |'
		);
	});
});

// These three moved here from the evidence-writing scripts, which each carried their own
// copy — toDateFolder in nine of them, fileExists in seven, byte-identical in every one.
const fileURLToPathSafe = (url: string): string => fileURLToPath(url);

describe('shared evidence-script helpers', () => {
	test('names an evidence folder by UTC date, not local date', () => {
		// 23:30 in UTC-05:00 is already the next day in UTC. The folder must follow UTC,
		// because that is what every script writing alongside it uses.
		expect(toDateFolder(new Date('2026-09-03T04:30:00.000Z'))).toBe(
			'2026-09-03'
		);
		expect(toDateFolder(new Date('2026-09-04T00:00:00.000Z'))).toBe(
			'2026-09-04'
		);
	});

	test('reports whether a path exists without throwing on a missing one', async () => {
		await expect(fileExists(fileURLToPathSafe(import.meta.url))).resolves.toBe(
			true
		);
		await expect(
			fileExists('/definitely/not/a/real/path/xyz.txt')
		).resolves.toBe(false);
	});

	test('identifies the entry-point module and rejects any other', () => {
		const entry = process.argv[1];
		if (entry === undefined) {
			expect(isEntryPoint('file:///anything')).toBe(false);
			return;
		}
		expect(isEntryPoint(pathToFileURL(entry).href)).toBe(true);
		expect(isEntryPoint('file:///some/other/module.mjs')).toBe(false);
	});
});
