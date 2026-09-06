// Purpose: Hold `vercel.json` in step with `SECURITY_HEADERS` for every page this build serves as
//          a static file, and keep it off the paths the SvelteKit function still renders.
// Why: `src/hooks.server.ts` attaches five security headers to every response the function
//      renders, and its own file header says why `vercel.json` covers the rest: the adapter's
//      generated route table puts `{"handle":"filesystem"}` ahead of the SSR rewrites, so anything
//      served from disk never reaches the hook — "the two must be changed together". Prerendering
//      the pages moved all fourteen documents from the function to disk, and that sentence became
//      a promise the repository was no longer keeping: `/`, `/meechie`, every mode page and the
//      offline page shipped with no X-Frame-Options at all, frameable by anyone, with no
//      Referrer-Policy, no Permissions-Policy and no nosniff. A CSP `<meta>` cannot substitute —
//      browsers ignore `frame-ancestors` there.
//      Caught by a Codex review on PR #311, not by any check, because nothing had ever had to
//      state the relationship between the two files. This is that statement, in a form that fails.
// Info flow: src/routes/**/+page.ts (prerender flags) + mode-catalog -> the document paths this
//            build writes to disk -> matched against vercel.json's sources -> assertions.
// Invariants:
//   - Every prerendered document path must be covered, with all five headers. Add a prerendered
//     route without a header entry and this test fails rather than the site quietly losing them.
//   - No source may match a path the function still serves. Vercel applies these headers on top of
//     the ones the hook already set, and a duplicated X-Frame-Options is dropped outright by some
//     browsers — which is the reason the original `vercel.json` named prefixes instead of `/(.*)`.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { SECURITY_HEADERS } from '../../src/hooks.server';
import { modeCatalog } from '../../src/lib/core/mode-catalog';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const read = (relativePath: string): string => readFileSync(resolve(repoRoot, relativePath), 'utf8');

type HeaderRule = { source: string; headers: { key: string; value: string }[] };
const vercelConfig = JSON.parse(read('vercel.json')) as { headers: HeaderRule[] };

/** Walk the route tree rather than listing routes, so a new one cannot be missed by hand. */
const routeFiles = (dir: string, found: string[] = []): string[] => {
	for (const entry of readdirSync(dir)) {
		const full = join(dir, entry);
		if (statSync(full).isDirectory()) routeFiles(full, found);
		else if (entry === '+page.ts') found.push(full);
	}
	return found;
};

/**
 * Every URL path this build writes to disk as a document.
 *
 * Derived from the `prerender` flags themselves — `true` and `'auto'` both produce a file — and
 * from `modeCatalog()` for the one dynamic segment, because `entries` in `m/[mode]/+page.ts`
 * enumerates exactly that. Restating the list here instead would be a second copy of it.
 */
const prerenderedDocumentPaths = (): string[] => {
	const routesDir = resolve(repoRoot, 'src/routes');
	const paths: string[] = [];

	for (const file of routeFiles(routesDir)) {
		const source = readFileSync(file, 'utf8');
		if (!/export const prerender\s*=\s*(true|'auto')/.test(source)) continue;

		const routePath = '/' + relative(routesDir, dirname(file)).split(/[\\/]/).join('/');
		const normalized = routePath === '/.' || routePath === '/' ? '/' : routePath;

		if (normalized.includes('[mode]')) {
			for (const mode of modeCatalog()) {
				paths.push(normalized.replace('[mode]', mode.slug));
			}
		} else {
			paths.push(normalized);
		}
	}

	return paths;
};

/** These sources are plain alternation patterns, so anchoring them is the whole matcher. */
const matches = (source: string, path: string): boolean =>
	new RegExp(`^${source}$`).test(path);

const headersFor = (path: string): Map<string, string> => {
	const applied = new Map<string, string>();
	for (const rule of vercelConfig.headers) {
		if (!matches(rule.source, path)) continue;
		for (const header of rule.headers) applied.set(header.key, header.value);
	}
	return applied;
};

const matchingRuleCount = (path: string): number =>
	vercelConfig.headers.filter((rule) => matches(rule.source, path)).length;

describe('security headers on prerendered documents', () => {
	// If this list ever came out empty the suite below would pass vacuously, which is the one way
	// a test that iterates over discovered inputs can lie.
	it('finds the documents this build writes to disk', () => {
		const paths = prerenderedDocumentPaths();

		expect(paths).toContain('/');
		expect(paths).toContain('/offline');
		expect(paths).toContain('/m/who-fucked-up');
		expect(paths.length).toBe(14);
	});

	it.each(prerenderedDocumentPaths())(
		'%s carries every header the server hook would have set',
		(path) => {
			const applied = headersFor(path);

			for (const [name, value] of SECURITY_HEADERS) {
				expect(applied.get(name), `${path} is missing ${name}`).toBe(value);
			}
		}
	);

	// The reason the file names paths instead of `/(.*)`: these still reach the hook, and a header
	// set twice is worse than one set once.
	it.each([
		['/api/generate'],
		['/api/meechie-studio-text'],
		// `SLUG_ALIASES` resolve through the function under `prerender = 'auto'`.
		['/m/receipts'],
		['/m/caption-this'],
		['/m/apology-translator'],
		// An unknown path falls to the catchall function and renders +error.svelte.
		['/not-a-page']
	])('%s is left to the server hook, with no duplicate from the platform', (path) => {
		expect(matchingRuleCount(path)).toBe(0);
	});
});
