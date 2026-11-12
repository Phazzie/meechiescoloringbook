#!/usr/bin/env node
/*
 * Purpose: Review a pull request with Grok and post one Origin comment.
 * Why: Depot runs this on pull requests after GitHub Actions is no longer the CI host.
 *      The job has to stay green before XAI_API_KEY is entered and on a runner where
 *      the `origin` CLI is not installed yet.
 * Info flow: env -> skip, or git diff against the base -> xAI chat completions ->
 *            `origin pr comment <PR_NUMBER> --body-file ... --edit-last --create-if-none`.
 *            With no pull request number the note is printed as one log line.
 *            A missing key, an empty diff, or a missing/failing `origin` CLI prints
 *            the reason and exits 0. An xAI HTTP error exits 1.
 * Invariants:
 *   - The model id is TEXT_MODEL from src/lib/core/models.js, the same pin the app uses.
 *   - The comment is posted only through the Origin CLI. GitHub's API is not called.
 *   - The review body is the only thing written to the temp file, and that file is removed.
 *   - Anything printed keeps its line breaks out of the log. Carriage returns and
 *     newlines become spaces, so a review cannot forge a later log line. The Origin
 *     comment file keeps the original line breaks.
 */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { TEXT_MODEL } from '../src/lib/core/models.js';

const MARKER = '<!-- meechies-coloringbook-ai-review -->';
const DIFF_CAP = 14_000;

/**
 * @param {NodeJS.ProcessEnv} env
 * @returns {{ action: 'skip', reason: string } | { action: 'review', apiKey: string }}
 */
export function reviewDecision(env) {
	const apiKey = env.XAI_API_KEY?.trim() ?? '';
	if (!apiKey) return { action: 'skip', reason: 'XAI_API_KEY is not set' };
	return { action: 'review', apiKey };
}

/** @param {string} diff */
export function clipDiff(diff) {
	const text = diff.trim();
	if (text.length <= DIFF_CAP) return text;
	return `${text.slice(0, DIFF_CAP)}\n\n[diff truncated]`;
}

/** @param {string} diff */
export function reviewPrompt(diff) {
	return [
		"You are reviewing a pull request for Meechie's Coloring Book, a SvelteKit app that turns Meechie verdicts into printable coloring pages.",
		'Comment only on real bugs, security issues, quota leaks, or broken page generation, print, share, or vault saves.',
		'Skip style nits. Use short paragraphs. If nothing is wrong, say so in one sentence.',
		'',
		clipDiff(diff)
	].join('\n');
}

/**
 * @param {NodeJS.ProcessEnv} env
 * @param {{ readFileSync?: (path: string, encoding: 'utf8') => string }} [deps]
 */
export function pullRequestNumber(env, deps = {}) {
	if (env.PR_NUMBER) return String(env.PR_NUMBER);
	if (!env.GITHUB_EVENT_PATH) return '';
	try {
		const read = deps.readFileSync ?? readFileSync;
		const event = JSON.parse(read(env.GITHUB_EVENT_PATH, 'utf8'));
		return event.pull_request?.number ? String(event.pull_request.number) : '';
	} catch {
		return '';
	}
}

/**
 * Origin when a pull request number is available. Otherwise the log.
 * GitHub is not a destination: this workflow runs after the repo leaves GitHub.
 * @param {NodeJS.ProcessEnv} env
 */
export function commentDestination(env) {
	if (pullRequestNumber(env)) return 'origin';
	return 'stdout';
}

/**
 * One log record. A review that still contained raw line breaks could append
 * fake log lines after itself. The same replacement is applied again on the value
 * passed to the logger: the log-injection check treats that call as neutralization.
 * @param {string} text
 */
export function oneLogLine(text) {
	return String(text).replace(/\r\n|[\r\n]/g, ' ');
}

/** @param {string} number @param {string} file */
export function originCommentArgs(number, file) {
	return [
		'pr',
		'comment',
		String(number),
		'--body-file',
		file,
		'--edit-last',
		'--create-if-none'
	];
}

/**
 * @param {NodeJS.ProcessEnv} env
 * @param {{ execFileSync?: typeof execFileSync }} [deps]
 */
export function diffAgainstBase(env, deps = {}) {
	const exec = deps.execFileSync ?? execFileSync;
	const base = env.GITHUB_BASE_REF || env.BASE_REF || 'main';
	try {
		exec('git', ['fetch', 'origin', base, '--depth', '50'], {
			stdio: 'ignore'
		});
	} catch {
		// The checkout may already contain the base.
	}
	try {
		return exec('git', ['diff', `origin/${base}...HEAD`], {
			encoding: 'utf8',
			maxBuffer: 8_000_000
		});
	} catch {
		return exec('git', ['diff', 'HEAD~1'], {
			encoding: 'utf8',
			maxBuffer: 8_000_000
		});
	}
}

/**
 * @param {string} apiKey
 * @param {string} diff
 * @param {{ fetch?: typeof fetch }} [deps]
 */
export async function askGrok(apiKey, diff, deps = {}) {
	const fetchImpl = deps.fetch ?? fetch;
	const res = await fetchImpl('https://api.x.ai/v1/chat/completions', {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			Authorization: `Bearer ${apiKey}`
		},
		body: JSON.stringify({
			model: TEXT_MODEL,
			max_tokens: 500,
			messages: [
				{
					role: 'system',
					content: 'You review code diffs. Be specific and brief.'
				},
				{ role: 'user', content: reviewPrompt(diff) }
			]
		}),
		signal: AbortSignal.timeout(45_000)
	});
	if (!res.ok) throw new Error(`xAI review failed (${res.status})`);
	const body = await res.json();
	const text = body?.choices?.[0]?.message?.content?.trim();
	if (!text) throw new Error('xAI review returned an empty note');
	return text;
}

/**
 * @param {string} number
 * @param {string} body
 * @param {{ execFileSync?: typeof execFileSync }} [deps]
 */
export function publishOnOrigin(number, body, deps = {}) {
	const exec = deps.execFileSync ?? execFileSync;
	const dir = mkdtempSync(join(tmpdir(), 'ai-review-'));
	const file = join(dir, 'comment.md');
	try {
		writeFileSync(file, body);
		exec('origin', originCommentArgs(number, file), { stdio: 'inherit' });
	} finally {
		rmSync(dir, { recursive: true, force: true });
	}
}

/**
 * @param {NodeJS.ProcessEnv} env
 * @param {string} body
 * @param {{ execFileSync?: typeof execFileSync, log?: (line: string) => void, error?: (line: string) => void }} [deps]
 * @returns {number}
 */
export function publish(env, body, deps = {}) {
	const log = deps.log ?? console.log;
	const error = deps.error ?? console.error;
	const destination = commentDestination(env);
	if (destination === 'stdout') {
		log(oneLogLine(body).replace(/\r\n|[\r\n]/g, ' '));
		log(
			'AI review printed locally. Set PR_NUMBER to comment on the Origin pull request.'
		);
		return 0;
	}
	try {
		publishOnOrigin(pullRequestNumber(env), body, deps);
		return 0;
	} catch (error_) {
		log(oneLogLine(body).replace(/\r\n|[\r\n]/g, ' '));
		const missing =
			error_ &&
			typeof error_ === 'object' &&
			'code' in error_ &&
			error_.code === 'ENOENT';
		error(
			oneLogLine(
				error_ instanceof Error ? error_.message : String(error_)
			).replace(/\r\n|[\r\n]/g, ' ')
		);
		log(
			missing
				? 'Origin CLI is not available. The review is in the log above.'
				: 'Origin comment failed. The review is in the log above.'
		);
		return 0;
	}
}

/**
 * @param {NodeJS.ProcessEnv} env
 * @param {Parameters<typeof publish>[2] & { fetch?: typeof fetch }} [deps]
 * @returns {Promise<number>}
 */
export async function runReview(env, deps = {}) {
	const log = deps.log ?? console.log;
	const decision = reviewDecision(env);
	if (decision.action === 'skip') {
		log(`AI review skipped: ${decision.reason}`);
		return 0;
	}
	const diff = String(diffAgainstBase(env, deps));
	if (!diff.trim()) {
		log('AI review skipped: empty diff');
		return 0;
	}
	const note = await askGrok(decision.apiKey, diff, deps);
	const body = `${MARKER}\n**Grok review**\n\n${note}`;
	return publish(env, body, deps);
}

const isDirect =
	process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isDirect) {
	try {
		const code = await runReview(process.env);
		process.exit(code);
	} catch (error_) {
		console.error(
			oneLogLine(
				error_ instanceof Error ? error_.message : String(error_)
			).replace(/\r\n|[\r\n]/g, ' ')
		);
		process.exit(1);
	}
}
