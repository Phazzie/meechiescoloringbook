// Purpose: Share normalization rules for generated evidence reports.
// Why: Keep evidence portable and seam status rollups consistent across tools.
// Info flow: generator values -> normalized report fields -> evidence artifacts.
import { promises as fs } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { pathToFileURL } from 'node:url';

/**
 * @param {string} root
 * @param {string} targetPath
 * @returns {string}
 */
export const toRepoRelativePath = (root, targetPath) => {
	const isWindowsAbsolutePath = /^[A-Za-z]:[\\/]/.test(targetPath);
	const relativePath = isWindowsAbsolutePath
		? path.win32.relative(root, targetPath)
		: path.isAbsolute(targetPath)
			? path.relative(root, targetPath)
			: targetPath;
	return relativePath.split(/[\\/]+/).join('/');
};

/**
 * @param {string} value
 * @returns {string}
 */
const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * @param {string} root
 * @param {string} output
 * @returns {string}
 */
export const sanitizeEvidenceOutput = (root, output) => {
	const slashRoot = root.split(/[\\/]+/).join('/');
	const backslashRoot = root.split(/[\\/]+/).join('\\');
	const rootPattern = [slashRoot, backslashRoot].map(escapeRegExp).join('|');
	const localRootPattern = new RegExp(`(?:${rootPattern})(?=$|[\\\\/\\s])`, 'gi');

	return output.replace(localRootPattern, '<REPO_ROOT>');
};

/**
 * @param {string[]} statuses
 * @returns {'missing' | 'blocked' | 'ok'}
 */
export const toSeamRollupStatus = (statuses) => {
	if (statuses.includes('missing')) {
		return 'missing';
	}
	if (statuses.includes('blocked')) {
		return 'blocked';
	}
	return 'ok';
};

/**
 * @param {string[]} cells
 * @returns {string}
 */
export const toMarkdownTableRow = (cells) => `| ${cells.join(' | ')} |`;

// The three helpers below were copy-pasted into every evidence-writing script:
// toDateFolder into nine of them, fileExists into seven, byte-identical in each. Sonar
// never counted it because the copies were old, until adding JSDoc to two of them made
// those lines new and the duplication gate failed at 7.0%. Shared here rather than
// deduplicated by hand in the two files that happened to trip it.

/**
 * @param {Date} date
 * @returns {string}
 */
export const toDateFolder = (date) => date.toISOString().slice(0, 10);

/**
 * @param {string} targetPath
 * @returns {Promise<boolean>}
 */
export const fileExists = async (targetPath) => {
	try {
		await fs.access(targetPath);
		return true;
	} catch {
		return false;
	}
};

/**
 * True when the given module is the process entry point. Scripts guard their top-level
 * run() with this so importing one to unit-test its helpers does not execute the gate
 * and rewrite its evidence artifact as a side effect.
 *
 * @param {string} moduleUrl - the calling module's `import.meta.url`
 * @returns {boolean}
 */
export const isEntryPoint = (moduleUrl) =>
	process.argv[1] !== undefined && moduleUrl === pathToFileURL(process.argv[1]).href;
