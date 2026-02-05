// Purpose: Install local git hooks for Seam-Driven Development enforcement.
// Why: Ensure verify gates run automatically before commit/push.
// Info flow: script -> git config + chmod -> hooks activated.
import { promises as fs } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { spawnSync } from 'node:child_process';

const ROOT = process.cwd();
const HOOKS_DIR = path.join(ROOT, '.githooks');
const REQUIRED_HOOKS = ['pre-commit', 'pre-push'];

const fileExists = async (targetPath) => {
	try {
		await fs.access(targetPath);
		return true;
	} catch {
		return false;
	}
};

const run = async () => {
	const gitDir = path.join(ROOT, '.git');
	if (!(await fileExists(gitDir))) {
		process.stderr.write('Hook install requires a git repository.\n');
		process.exit(1);
	}
	if (!(await fileExists(HOOKS_DIR))) {
		process.stderr.write('Hook install failed: .githooks directory missing.\n');
		process.exit(1);
	}

	for (const hook of REQUIRED_HOOKS) {
		const hookPath = path.join(HOOKS_DIR, hook);
		if (!(await fileExists(hookPath))) {
			process.stderr.write(`Hook install failed: missing ${hookPath}.\n`);
			process.exit(1);
		}
		await fs.chmod(hookPath, 0o755);
	}

	const result = spawnSync('git', ['config', 'core.hooksPath', '.githooks'], {
		cwd: ROOT,
		encoding: 'utf8'
	});
	if (result.status !== 0) {
		process.stderr.write(result.stderr || 'Hook install failed.\n');
		process.exit(1);
	}
	process.stdout.write('Git hooks installed: core.hooksPath=.githooks\n');
};

run().catch((error) => {
	process.stderr.write(`Hook install failed: ${error.message}\n`);
	process.exit(1);
});
