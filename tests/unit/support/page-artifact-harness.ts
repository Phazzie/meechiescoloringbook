// Purpose: The stubbed browser, provider responses and adapter spies every test of a
//          `PageArtifactState` subclass needs before it can assert anything.
// Why: `VerdictPageState` and `DescribePageState` extend one class, and their two test files each
//      carried a byte-similar copy of this scaffolding — **116 duplicated lines**, which
//      SonarCloud's duplication gate measured at 4.0% of new code against a 3% limit and failed the
//      pull request on. `tests/e2e/support/page-fixtures.ts` exists for exactly the same reason and
//      records exactly the same failure. The copies are also the wrong shape for a second reason:
//      the response fixtures encode contract constraints, and a second copy is a second place for
//      those to fall out of date.
// Info flow: a test's `beforeEach` -> stubbed `fetch`, `Image` and adapters -> the class under test
//            -> the test's own assertions.
// Invariants:
//   - Nothing here asserts anything. A helper that fails a test is a helper that fails it in every
//     file at once, for a reason none of their names mention.
//   - Not matched by vitest's `include` (`tests/**/*.test.ts`), so it is a module these tests import
//     rather than a test file with no tests in it.
import { afterEach, beforeEach, vi } from 'vitest';
import { creationStoreAdapter } from '../../../src/lib/adapters/creation-store.adapter';
import { outputPackagingAdapter } from '../../../src/lib/adapters/output-packaging.adapter';
import { sessionAdapter } from '../../../src/lib/adapters/session.adapter';
import type { CreationRecord } from '../../../contracts/creation-store.contract';

/** The smallest base64 payload the pipeline treats as an image: three bytes, "ABC". */
export const IMAGE = {
	id: 'img-1',
	format: 'png' as const,
	mimeType: 'image/png',
	data: 'QUJD',
	encoding: 'base64' as const
};

/** A `/api/generate` success body that satisfies `GenerateResultSchema`. */
export const generateValue = (
	overrides: Record<string, unknown> = {}
): Record<string, unknown> => ({
	prompt: 'assembled prompt',
	templateVersion: 'v1',
	images: [IMAGE],
	revisedPrompt: 'revised prompt',
	violations: [],
	recommendedFixes: [],
	...overrides
});

export const PRINT_FILE = {
	filename: 'print.pdf',
	mimeType: 'application/pdf',
	dataBase64: 'UFJJTlQ='
};

export const SHARE_FILE = {
	filename: 'square.pdf',
	mimeType: 'application/pdf',
	dataBase64: 'U0hBUkU='
};

/** Resolve every already-queued microtask, and the promise chains they in turn queue. */
export const flush = async (): Promise<void> => {
	for (let i = 0; i < 8; i += 1) await Promise.resolve();
};

export type Deferred<T> = { promise: Promise<T>; resolve: (value: T) => void };

/** A promise a test resolves when it chooses, for holding a request open mid-flight. */
export const defer = <T>(): Deferred<T> => {
	let resolve!: (value: T) => void;
	const promise = new Promise<T>((res) => {
		resolve = res;
	});
	return { promise, resolve };
};

export const jsonResponse = (
	body: unknown,
	init: { status?: number; headers?: Record<string, string> } = {}
): Response =>
	new Response(JSON.stringify(body), {
		status: init.status ?? 200,
		headers: { 'Content-Type': 'application/json', ...(init.headers ?? {}) }
	});

/** What each stubbed endpoint returns next, and every URL that has been requested. */
export type FetchStub<Key extends string> = {
	routes: Partial<Record<Key, () => Promise<Response>>>;
	calls: string[];
};

/**
 * Stub `fetch` for a named set of endpoints.
 *
 * Keyed rather than matched by string inside the handler, so a test file names its endpoints once
 * and every case afterwards reads `routes.generate` instead of a URL literal. A request to anything
 * not in the map throws by name, because a silently-unstubbed call is a test asserting against a
 * network that is not there.
 */
export const stubFetchRoutes = <Key extends string>(
	urlByKey: Record<Key, string>
): FetchStub<Key> => {
	const stub: FetchStub<Key> = { routes: {}, calls: [] };
	const keyByUrl = new Map<string, Key>(
		(Object.entries(urlByKey) as [Key, string][]).map(([key, url]) => [url, key])
	);
	vi.stubGlobal(
		'fetch',
		vi.fn(async (url: string) => {
			stub.calls.push(url);
			const key = keyByUrl.get(url);
			const handler = key === undefined ? undefined : stub.routes[key];
			if (!handler) throw new Error(`Unstubbed request to ${url}`);
			return handler();
		})
	);
	return stub;
};

/**
 * Decide per URL whether the browser can decode a preview.
 *
 * jsdom provides an `Image` constructor but never loads anything, so neither `onload` nor `onerror`
 * would ever fire and the real decode probe would hang forever. This stub decides synchronously and
 * reports on the next microtask, which is also how the corrupt-bytes cases are driven.
 */
export const stubImageDecoder = (decides: (src: string) => boolean): void => {
	vi.stubGlobal(
		'Image',
		class {
			onload: (() => void) | null = null;
			onerror: (() => void) | null = null;
			naturalWidth = 0;
			naturalHeight = 0;
			set src(value: string) {
				const decodable = decides(value);
				queueMicrotask(() => {
					if (decodable) {
						this.naturalWidth = 1;
						this.naturalHeight = 1;
						this.onload?.();
					} else {
						this.onerror?.();
					}
				});
			}
		}
	);
};

/**
 * Spy the three adapters a finished page reaches: the session it is owned by, the packaging that
 * builds its downloads, and the store it is saved into.
 *
 * `savedRecord` is the record `saveCreation` echoes back — the contract returns the stored record
 * rather than a flag, so a test that wants to assert on the save needs one to hand.
 */
export const spyPageAdapters = (savedRecord: CreationRecord): void => {
	vi.spyOn(sessionAdapter, 'getSession').mockResolvedValue({
		ok: true,
		value: { sessionId: 'session-1' }
	});
	vi.spyOn(outputPackagingAdapter, 'package').mockImplementation(async (input) =>
		input.variants?.includes('square')
			? { ok: true, value: { files: [SHARE_FILE] } }
			: { ok: true, value: { files: [PRINT_FILE] } }
	);
	vi.spyOn(creationStoreAdapter, 'saveCreation').mockResolvedValue({
		ok: true,
		value: savedRecord
	});
};

/**
 * Register the setup and teardown every `PageArtifactState` test file needs.
 *
 * A function rather than four lines copied into each `beforeEach`: what a test of one of these
 * classes must have in place before it can assert anything is a fact about the class, and it
 * belongs in one place — the same argument that put the fixtures above here. `stubFetch` is passed
 * in because the endpoints differ per subclass, and it runs first so a test's own `routes` object
 * exists before anything can reach for it.
 */
export const usePageArtifactHarness = (options: {
	/** Installs the file's own `fetch` stub, built from `stubFetchRoutes`. */
	stubFetch: () => void;
	/** The record `saveCreation` echoes back for this file's fixtures. */
	savedRecord: CreationRecord;
}): void => {
	beforeEach(() => {
		options.stubFetch();
		stubImageDecoder(() => true);
		spyPageAdapters(options.savedRecord);
	});

	afterEach(() => {
		vi.restoreAllMocks();
		vi.unstubAllGlobals();
	});
};
