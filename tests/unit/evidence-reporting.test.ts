// Purpose: Covers shared evidence-reporting helpers for generated proof artifacts.
// Why: Prevent local machine paths and inconsistent seam rollups from entering committed evidence.
// Info flow: helper inputs -> normalized report values -> evidence generator scripts.
import path from 'node:path';
import { describe, expect, test } from 'vitest';

import {
	sanitizeEvidenceOutput,
	toMarkdownTableRow,
	toRepoRelativePath,
	toSeamRollupStatus
} from '../../scripts/evidence-reporting.mjs';

describe('evidence reporting helpers', () => {
	test('normalizes evidence paths to repository-relative slash paths', () => {
		const root = path.win32.join('C:\\', 'Users', 'ieatc', 'Meechiescoloringbook');
		const target = path.win32.join(root, 'docs', 'evidence', '2026-05-04', 'verify.txt');

		expect(toRepoRelativePath(root, target)).toBe('docs/evidence/2026-05-04/verify.txt');
	});

	test('sanitizes local repository roots from captured evidence output', () => {
		const root = path.win32.join('C:\\', 'Users', 'ieatc', 'Meechiescoloringbook');
		const output = [
			`Loading svelte-check in workspace: ${root}`,
			`RUN v3.2.4 ${root.split(/[\\/]+/).join('/')}`
		].join('\n');

		expect(sanitizeEvidenceOutput(root, output)).toBe(
			['Loading svelte-check in workspace: <REPO_ROOT>', 'RUN v3.2.4 <REPO_ROOT>'].join(
				'\n'
			)
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
