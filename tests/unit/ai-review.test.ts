// Purpose: Prove the Depot pull-request review skips without a key and posts through Origin.
// Why: The review job has to stay green before XAI_API_KEY exists and when the origin CLI is absent.
// Info flow: fixture env and a fake fetch/exec -> scripts/ai-review.mjs -> exit and log assertions.
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { TEXT_MODEL } from '../../src/lib/core/models';
import {
	askGrok,
	clipDiff,
	commentDestination,
	originCommentArgs,
	publish,
	pullRequestNumber,
	reviewDecision,
	reviewPrompt,
	runReview
} from '../../scripts/ai-review.mjs';

const repoRoot = path.resolve(import.meta.dirname, '../..');

describe('ai review', () => {
	it('skips when the key is missing and reviews when it is set', () => {
		expect(reviewDecision({}).action).toBe('skip');
		expect(reviewDecision({ XAI_API_KEY: '  ' }).action).toBe('skip');
		expect(reviewDecision({ XAI_API_KEY: 'xai-test' }).action).toBe('review');
	});

	it('clips a huge diff and keeps a short one', () => {
		expect(clipDiff('small')).toBe('small');
		const huge = 'a'.repeat(20_000);
		const clipped = clipDiff(huge);
		expect(clipped.endsWith('[diff truncated]')).toBe(true);
		expect(clipped.length).toBeLessThan(huge.length);
	});

	it('comments on Origin when there is a pull request number', () => {
		expect(commentDestination({ PR_NUMBER: '8' })).toBe('origin');
		expect(commentDestination({})).toBe('stdout');
		expect(
			commentDestination({
				PR_NUMBER: '8',
				GITHUB_TOKEN: 'ghs',
				GITHUB_REPOSITORY: 'Phazzie/meechiescoloringbook'
			})
		).toBe('origin');
	});

	it('reads the pull request number from the event file', () => {
		const dir = mkdtempSync(path.join(tmpdir(), 'ai-review-event-'));
		const eventPath = path.join(dir, 'event.json');
		writeFileSync(eventPath, JSON.stringify({ pull_request: { number: 42 } }));
		expect(pullRequestNumber({ GITHUB_EVENT_PATH: eventPath })).toBe('42');
		expect(
			pullRequestNumber({ GITHUB_EVENT_PATH: path.join(dir, 'missing.json') })
		).toBe('');
	});

	it('asks for bugs rather than style notes', () => {
		const prompt = reviewPrompt('diff --git a/pay.ts');
		expect(prompt).toMatch(/Meechie/);
		expect(prompt).toMatch(/security|quota/i);
		expect(prompt).toContain('diff --git a/pay.ts');
	});

	it('builds the Origin comment command', () => {
		expect(originCommentArgs('15', '/tmp/comment.md')).toEqual([
			'pr',
			'comment',
			'15',
			'--body-file',
			'/tmp/comment.md',
			'--edit-last',
			'--create-if-none'
		]);
	});

	it('asks the pinned text model', async () => {
		let sent = '';
		const note = await askGrok('test-key', 'diff --git a/page.ts', {
			fetch: (async (_url: string, init?: { body?: string }) => {
				sent = init?.body ?? '';
				return {
					ok: true,
					json: async () => ({
						choices: [{ message: { content: '  No bugs.  ' } }]
					})
				};
			}) as unknown as typeof fetch
		});
		expect(note).toBe('No bugs.');
		expect(JSON.parse(sent).model).toBe(TEXT_MODEL);
	});

	it('prints the review and exits 0 when the Origin CLI is missing', () => {
		const lines: string[] = [];
		const missing = Object.assign(new Error('spawn origin ENOENT'), {
			code: 'ENOENT'
		});
		const code = publish({ PR_NUMBER: '4' }, '**Grok review**\n\nLook here.', {
			execFileSync: () => {
				throw missing;
			},
			log: (line) => lines.push(line),
			error: (line) => lines.push(line)
		});
		expect(code).toBe(0);
		expect(lines.join('\n')).toContain('Look here.');
		expect(lines.join('\n')).toMatch(/Origin CLI is not available/);
	});

	it('exits 0 from the script when XAI_API_KEY is unset', () => {
		const result = spawnSync(process.execPath, ['scripts/ai-review.mjs'], {
			cwd: repoRoot,
			env: { ...process.env, XAI_API_KEY: '' },
			encoding: 'utf8'
		});
		expect(result.status).toBe(0);
		expect(result.stdout).toMatch(/AI review skipped: XAI_API_KEY is not set/);
	});

	it('returns 0 from the full review when Origin cannot be spawned', async () => {
		const lines: string[] = [];
		const code = await runReview(
			{ XAI_API_KEY: 'test-key', PR_NUMBER: '9', GITHUB_BASE_REF: 'main' },
			{
				execFileSync: ((command: string) => {
					if (command === 'git')
						return 'diff --git a/src/page.ts b/src/page.ts\n';
					throw Object.assign(new Error('spawn origin ENOENT'), {
						code: 'ENOENT'
					});
				}) as typeof import('node:child_process').execFileSync,
				fetch: (async () => ({
					ok: true,
					json: async () => ({
						choices: [{ message: { content: 'No bugs.' } }]
					})
				})) as unknown as typeof fetch,
				log: (line: string) => lines.push(line),
				error: (line: string) => lines.push(line)
			}
		);
		expect(code).toBe(0);
		expect(lines.join('\n')).toContain('No bugs.');
		expect(lines.join('\n')).toMatch(/Origin CLI is not available/);
	});
});
