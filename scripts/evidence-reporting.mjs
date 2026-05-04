// Purpose: Share normalization rules for generated evidence reports.
// Why: Keep evidence portable and seam status rollups consistent across tools.
// Info flow: generator values -> normalized report fields -> evidence artifacts.
import path from 'node:path';

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
	const localRootPattern = new RegExp(rootPattern, 'gi');

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
