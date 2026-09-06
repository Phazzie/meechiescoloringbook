// Purpose: Unit tests for `VerdictPageState`, the verdict-to-coloring-page lifecycle behind
//          `/who-fucked-up`, `/rate-his-excuse` and `/random`.
// Why: Every defect this class was written to remove is invisible from the outside — a page that
//      lands under the wrong verdict, a dedication that stops matching the download, a print PDF
//      lost to a share-image failure, a verdict destroyed by a failed retry. Each one gets a test
//      that fails if the guard is removed.
// Info flow: stubbed fetch + spied adapters -> VerdictPageState methods -> state assertions.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { creationStoreAdapter } from '../../src/lib/adapters/creation-store.adapter';
import { outputPackagingAdapter } from '../../src/lib/adapters/output-packaging.adapter';
import { sessionAdapter } from '../../src/lib/adapters/session.adapter';
import { VerdictPageState } from '../../src/lib/components/verdict-page-state.svelte';
import { GenerateResultSchema } from '../../contracts/generate.contract';
import { MeechieToolResultSchema } from '../../contracts/meechie-tool.contract';
import type {
	MeechieToolInput,
	MeechieToolOutput
} from '../../contracts/meechie-tool.contract';
import type { CreationRecord } from '../../contracts/creation-store.contract';
import type { ClockSeam } from '../../src/lib/seams/clock-seam/contract';

/** A verdict that parses into printable structure — the case the old routes threw away. */
const STRUCTURED_VERDICT: MeechieToolOutput = {
	toolId: 'red_flag_or_run',
	headline: 'Red flag',
	response:
		'Fault: he had time to answer. Consequence: he lost the spare key. Move: stop explaining yourself.'
};

/** A verdict with no structure at all — a perfectly good full-quote page. */
const PLAIN_VERDICT: MeechieToolOutput = {
	toolId: 'random_meechie',
	headline: 'Meechie says',
	response: 'His story keeps changing and yours never had to.'
};

const IMAGE = {
	id: 'img-1',
	format: 'png' as const,
	mimeType: 'image/png',
	data: 'QUJD',
	encoding: 'base64' as const
};

const generateValue = (overrides: Record<string, unknown> = {}) => ({
	prompt: 'assembled prompt',
	templateVersion: 'v1',
	images: [IMAGE],
	revisedPrompt: 'revised prompt',
	violations: [],
	recommendedFixes: [],
	...overrides
});

const printFile = {
	filename: 'print.pdf',
	mimeType: 'application/pdf',
	dataBase64: 'UFJJTlQ='
};
const shareFile = {
	filename: 'square.pdf',
	mimeType: 'application/pdf',
	dataBase64: 'U0hBUkU='
};

/** Resolve every already-queued microtask, and the promise chains they in turn queue. */
const flush = async (): Promise<void> => {
	for (let i = 0; i < 8; i += 1) await Promise.resolve();
};

type Deferred<T> = { promise: Promise<T>; resolve: (value: T) => void };
const defer = <T>(): Deferred<T> => {
	let resolve!: (value: T) => void;
	const promise = new Promise<T>((res) => {
		resolve = res;
	});
	return { promise, resolve };
};

const jsonResponse = (body: unknown): Response =>
	new Response(JSON.stringify(body), {
		status: 200,
		headers: { 'Content-Type': 'application/json' }
	});

/** What `/api/tools` and `/api/generate` return for the next call, keyed by path. */
type Routes = {
	tools?: () => Promise<Response>;
	generate?: () => Promise<Response>;
};

let routes: Routes;
let fetchCalls: string[];

/**
 * jsdom provides an `Image` constructor but never loads anything, so neither `onload` nor
 * `onerror` would ever fire and the real decode probe would hang forever. This stub decides per
 * URL, which is also how the corrupt-bytes cases below are driven.
 */
const stubImageDecoder = (decides: (src: string) => boolean): void => {
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

const stubFetch = (): void => {
	fetchCalls = [];
	vi.stubGlobal(
		'fetch',
		vi.fn(async (url: string) => {
			fetchCalls.push(url);
			if (url === '/api/tools' && routes.tools) return routes.tools();
			if (url === '/api/generate' && routes.generate) return routes.generate();
			throw new Error(`Unstubbed request to ${url}`);
		})
	);
};

const okTools = (verdict: MeechieToolOutput) => async () =>
	jsonResponse({ ok: true, value: verdict });
const okGenerate =
	(overrides: Record<string, unknown> = {}) =>
	async () =>
		jsonResponse({ ok: true, value: generateValue(overrides) });

/**
 * The tool input that produces each fixture verdict. `MeechieToolInput` is a discriminated union,
 * so the input has to be paired with its verdict rather than derived from `verdict.toolId`.
 */
const INPUT_FOR: Record<string, MeechieToolInput> = {
	[STRUCTURED_VERDICT.toolId]: {
		toolId: 'red_flag_or_run',
		situation: 'He went quiet for a week.'
	},
	[PLAIN_VERDICT.toolId]: { toolId: 'random_meechie' }
};

/** A save result the real contract accepts: `saveCreation` returns the stored record, not a flag. */
const savedRecord = (
	record: CreationRecord
): { ok: true; value: CreationRecord } => ({
	ok: true,
	value: record
});

const STORED_RECORD: CreationRecord = {
	id: 'creation-1',
	createdAtISO: '2026-09-04T00:00:00.000Z',
	intent: {
		title: 'STORED',
		listMode: 'title_only',
		items: [],
		alignment: 'center',
		numberAlignment: 'strict',
		listGutter: 'normal',
		whitespaceScale: 35,
		textSize: 'large',
		fontStyle: 'block',
		textStrokeWidth: 9,
		colorMode: 'black_and_white_only',
		decorations: 'dense',
		illustrations: 'simple',
		shading: 'none',
		border: 'decorative',
		borderThickness: 10,
		variations: 1,
		outputFormat: 'pdf',
		pageSize: 'US_Letter'
	},
	assembledPrompt: 'assembled prompt',
	owner: { kind: 'anonymous', sessionId: 'session-1' }
};

/** Build a state whose session has already resolved, so saves are not racing the constructor. */
const readyState = async (
	slug = 'who-fucked-up'
): Promise<VerdictPageState> => {
	const state = new VerdictPageState({ fileBaseSlug: slug });
	await flush();
	return state;
};

/** Drive a state to "a page exists", the precondition for the download and save assertions. */
const withPage = async (
	verdict: MeechieToolOutput = STRUCTURED_VERDICT
): Promise<VerdictPageState> => {
	const state = await readyState();
	routes.tools = okTools(verdict);
	routes.generate = okGenerate();
	await state.requestVerdict(INPUT_FOR[verdict.toolId]);
	await state.makePage();
	return state;
};

beforeEach(() => {
	routes = {};
	stubFetch();
	stubImageDecoder(() => true);
	vi.spyOn(sessionAdapter, 'getSession').mockResolvedValue({
		ok: true,
		value: { sessionId: 'session-1' }
	});
	vi.spyOn(outputPackagingAdapter, 'package').mockImplementation(
		async (input) =>
			input.variants?.includes('square')
				? { ok: true, value: { files: [shareFile] } }
				: { ok: true, value: { files: [printFile] } }
	);
	vi.spyOn(creationStoreAdapter, 'saveCreation').mockResolvedValue(
		savedRecord(STORED_RECORD)
	);
});

afterEach(() => {
	vi.restoreAllMocks();
	vi.unstubAllGlobals();
});

describe('fixtures', () => {
	it('the stubbed responses actually satisfy the real contracts', () => {
		// If this drifts, every test below would pass through the "did not match contract" branch
		// and assert on the wrong thing.
		expect(
			MeechieToolResultSchema.safeParse({ ok: true, value: STRUCTURED_VERDICT })
				.success
		).toBe(true);
		expect(
			GenerateResultSchema.safeParse({ ok: true, value: generateValue() })
				.success
		).toBe(true);
	});
});

describe('requestVerdict', () => {
	it('installs the verdict returned by the tool', async () => {
		const state = await readyState();
		routes.tools = okTools(STRUCTURED_VERDICT);
		await state.requestVerdict({
			toolId: 'red_flag_or_run',
			situation: 'He went quiet.'
		});
		expect(state.verdict).toEqual(STRUCTURED_VERDICT);
		expect(state.error).toBe('');
		expect(state.isWorking).toBe(false);
	});

	it('rejects an input the contract would refuse without spending a request', async () => {
		const state = await readyState();
		await state.requestVerdict({ toolId: 'red_flag_or_run', situation: '' });
		expect(state.error).toContain('complete the required fields');
		expect(fetchCalls).not.toContain('/api/tools');
	});

	it('keeps the previous verdict and its page when a retry fails', async () => {
		// The old routes cleared the verdict and the previews before the request went out, so a
		// timeout destroyed a page the user had already paid a generation for.
		const state = await withPage();
		expect(state.hasPage).toBe(true);

		routes.tools = async () => {
			throw new Error('Network is down');
		};
		await state.requestVerdict({
			toolId: 'red_flag_or_run',
			situation: 'Try again.'
		});

		expect(state.error).toBe('Network is down');
		expect(state.verdict).toEqual(STRUCTURED_VERDICT);
		expect(state.hasPage).toBe(true);
		expect(state.imagePreviews).toHaveLength(1);
	});

	it('reports an off-contract tool response instead of installing it', async () => {
		const state = await readyState();
		routes.tools = async () =>
			jsonResponse({ ok: true, value: { toolId: 'nope' } });
		await state.requestVerdict({ toolId: 'random_meechie' });
		expect(state.verdict).toBeNull();
		expect(state.error).toBe('Tool response did not match contract.');
	});

	it('returns the verdict it installed, and null when it did not install one', async () => {
		// Callers cannot compute this: comparing `verdict` before and after only proves something
		// changed, not that this request changed it.
		const state = await readyState();
		routes.tools = okTools(PLAIN_VERDICT);
		await expect(
			state.requestVerdict({ toolId: 'random_meechie' })
		).resolves.toEqual(PLAIN_VERDICT);

		routes.tools = async () =>
			jsonResponse({
				ok: false,
				error: { code: 'NOPE', message: 'Tool is down.' }
			});
		await expect(
			state.requestVerdict({ toolId: 'random_meechie' })
		).resolves.toBeNull();

		await expect(
			state.requestVerdict({ toolId: 'red_flag_or_run', situation: '' })
		).resolves.toBeNull();
	});

	it('returns null from a request a reset abandoned, even once a newer one has landed', async () => {
		// The relabelling race: an abandoned request whose replacement has already installed sees
		// the same "verdict changed" as a successful one. Only the return value tells them apart.
		const state = await readyState();
		const gate = defer<Response>();
		routes.tools = () => gate.promise;
		const abandoned = state.requestVerdict({
			toolId: 'red_flag_or_run',
			situation: 'Excuse A.'
		});

		state.reset();
		routes.tools = okTools(PLAIN_VERDICT);
		const replacement = await state.requestVerdict({
			toolId: 'random_meechie'
		});
		expect(replacement).toEqual(PLAIN_VERDICT);

		gate.resolve(jsonResponse({ ok: true, value: STRUCTURED_VERDICT }));
		await expect(abandoned).resolves.toBeNull();
		expect(state.verdict).toEqual(PLAIN_VERDICT);
	});

	it('discards a verdict abandoned by reset() rather than installing it late', async () => {
		const state = await readyState();
		const gate = defer<Response>();
		routes.tools = () => gate.promise;

		const pending = state.requestVerdict({ toolId: 'random_meechie' });
		expect(state.isWorking).toBe(true);

		state.reset();
		gate.resolve(jsonResponse({ ok: true, value: PLAIN_VERDICT }));
		await pending;

		expect(state.verdict).toBeNull();
		// The reset released the button; the abandoned request must not touch it either way.
		expect(state.isWorking).toBe(false);
	});
});

describe('makePage', () => {
	it('prints a structured verdict as a list page, not a flattened title', async () => {
		// This is the defect the whole rebuild exists for: all three routes sent `title_only` for
		// every verdict, discarding the Fault/Consequence/Move structure the prompt asks for.
		const state = await withPage(STRUCTURED_VERDICT);
		const body = JSON.parse(
			(
				vi
					.mocked(fetch)
					.mock.calls.find(
						([url]) => url === '/api/generate'
					)?.[1] as RequestInit
			).body as string
		);
		expect(body.spec.listMode).toBe('list');
		expect(body.spec.items.length).toBeGreaterThanOrEqual(2);
		expect(body.styleHint).toBeTruthy();
		expect(state.hasPage).toBe(true);
	});

	it('still prints an unstructured verdict as a full-quote page', async () => {
		const state = await withPage(PLAIN_VERDICT);
		const body = JSON.parse(
			(
				vi
					.mocked(fetch)
					.mock.calls.find(
						([url]) => url === '/api/generate'
					)?.[1] as RequestInit
			).body as string
		);
		expect(body.spec.listMode).toBe('title_only');
		expect(body.spec.items).toEqual([]);
		expect(state.hasPage).toBe(true);
	});

	it('packages print and share separately so one failure cannot take the other down', async () => {
		const state = await withPage();
		const variants = vi
			.mocked(outputPackagingAdapter.package)
			.mock.calls.map(([input]) => input.variants);
		expect(variants).toEqual([['print'], ['square']]);
		expect(state.packagedFiles).toEqual([printFile, shareFile]);
	});

	it('keeps the printable PDF when only the square share image fails', async () => {
		// The single-call version returned the square failure *without* the print file it had
		// already built, so a browser that could not encode the share canvas lost the product.
		vi.mocked(outputPackagingAdapter.package).mockImplementation(
			async (input) =>
				input.variants?.includes('square')
					? {
							ok: false,
							error: { code: 'CANVAS_UNAVAILABLE', message: 'no canvas' }
						}
					: { ok: true, value: { files: [printFile] } }
		);
		const state = await withPage();
		expect(state.packagedFiles).toEqual([printFile]);
		expect(state.generateError).toContain(
			'square share image could not be built'
		);
	});

	it('keeps the page and the print PDF when the square packaging call throws', async () => {
		// `outputPackagingAdapter.package` has no try/catch of its own — pdf-lib's embedPng/embedJpg
		// and the canvas in imageToPngBase64 all throw. A rejection from the square call used to
		// escape to the outer catch, discarding the paid images and the print PDF already built, so
		// splitting the two calls bought nothing against the failure shape most likely to happen.
		vi.mocked(outputPackagingAdapter.package).mockImplementation(
			async (input) => {
				if (input.variants?.includes('square'))
					throw new Error('canvas is tainted');
				return { ok: true, value: { files: [printFile] } };
			}
		);
		const state = await withPage();

		expect(state.hasPage).toBe(true);
		expect(state.imagePreviews).toHaveLength(1);
		expect(state.packagedFiles).toEqual([printFile]);
		expect(state.generateError).toContain(
			'square share image could not be built'
		);
		expect(state.generateError).toContain('canvas is tainted');
	});

	it('keeps the page when the print packaging call throws too', async () => {
		// The page is the paid part and it already exists; a local render failure must never take it.
		vi.mocked(outputPackagingAdapter.package).mockRejectedValue(
			new Error('no canvas here')
		);
		const state = await withPage();

		expect(state.hasPage).toBe(true);
		expect(state.imagePreviews).toHaveLength(1);
		expect(state.packagedFiles).toEqual([]);
		expect(state.generateError).toContain(
			'printable download could not be built'
		);
	});

	it('drops an image the browser cannot decode before it becomes a saveable page', async () => {
		// `GeneratedImageSchema` constrains `data` only to be non-empty and the pipeline labels
		// unrecognised bytes as PNG, so corrupt or truncated base64 passes the contract intact.
		// Installing it unchecked would put a broken preview on screen and arm Save to persist
		// bytes nothing can read.
		const good = { ...IMAGE, id: 'good', data: 'R09PRA==' };
		const corrupt = { ...IMAGE, id: 'corrupt', data: 'Q09SUlVQVA==' };
		stubImageDecoder((src) => !src.includes('Q09SUlVQVA=='));

		const state = await readyState();
		routes.tools = okTools(PLAIN_VERDICT);
		routes.generate = okGenerate({ images: [good, corrupt] });
		await state.requestVerdict({ toolId: 'random_meechie' });
		await state.makePage();

		expect(state.imagePreviews).toHaveLength(1);
		expect(state.imagePreviews[0]).toContain('R09PRA==');
		await state.saveToVault();
		const record = vi.mocked(creationStoreAdapter.saveCreation).mock.calls[0][0]
			.record as CreationRecord;
		expect(record.images).toEqual([{ b64: 'R09PRA==' }]);
	});

	it('keeps the page already on screen when nothing in the response decodes', async () => {
		const state = await withPage(PLAIN_VERDICT);
		expect(state.hasPage).toBe(true);
		const previewsBefore = [...state.imagePreviews];

		stubImageDecoder(() => false);
		await state.makePage();

		expect(state.generateError).toContain('could not be read');
		expect(state.generateError).toContain('page on screen was kept');
		expect(state.hasPage).toBe(true);
		expect(state.imagePreviews).toEqual(previewsBefore);
	});

	it('surfaces the check result when nothing decodes and there is no page to protect', async () => {
		// The no-usable-image guard returned before the drift state was assigned, so a first request
		// that came back with findings but no readable picture showed only the image error and left
		// the report `unchecked` — suppressing the very thing this change exists to surface.
		const state = await readyState();
		routes.tools = okTools(PLAIN_VERDICT);
		routes.generate = okGenerate({
			violations: [
				{ code: 'MISSING_OPTION_LINE', message: 'Missing option line: Border: thin.', severity: 'error' }
			]
		});
		stubImageDecoder(() => false);
		await state.requestVerdict({ toolId: 'random_meechie' });
		await state.makePage();

		expect(state.hasPage).toBe(false);
		expect(state.generateError).toContain('could not be read');
		expect(state.qualityReport.state).toBe('flagged');
		if (state.qualityReport.state === 'flagged') {
			expect(state.qualityReport.findings[0].message).toContain('Missing option line');
		}
	});

	it('leaves an existing page report alone when a replacement does not decode', async () => {
		// The mirror of the test above, and the reason the fix is conditional rather than a hoist:
		// a page on screen keeps its own report. Attaching a later request's findings to a page they
		// do not describe is the conflation this change removes.
		const state = await withPage(PLAIN_VERDICT);
		const reportBefore = state.qualityReport;

		routes.generate = okGenerate({
			violations: [
				{ code: 'MISSING_OPTION_LINE', message: 'a finding about a page that never landed', severity: 'error' }
			]
		});
		stubImageDecoder(() => false);
		await state.makePage();

		expect(state.hasPage).toBe(true);
		expect(state.qualityReport).toEqual(reportBefore);
	});

	it('does not start the square render once the run is already stale', async () => {
		// The square variant rasterises a 1080px canvas. Starting it for a page the user has
		// already replaced burns time and memory on a result guaranteed to be discarded.
		const state = await readyState();
		routes.tools = okTools(PLAIN_VERDICT);
		routes.generate = okGenerate();
		await state.requestVerdict({ toolId: 'random_meechie' });

		const gate = defer<{ ok: true; value: { files: (typeof printFile)[] } }>();
		vi.mocked(outputPackagingAdapter.package).mockImplementation(
			async (input) =>
				input.variants?.includes('print')
					? gate.promise
					: { ok: true, value: { files: [shareFile] } }
		);

		const generating = state.makePage();
		// Wait for the print call to actually be in flight. A fixed number of microtask ticks is not
		// enough — the generate fetch and the decode probes come first — and resetting too early
		// would make this pass for the wrong reason, by never reaching packaging at all.
		while (vi.mocked(outputPackagingAdapter.package).mock.calls.length === 0) {
			await flush();
		}
		state.resetPage();
		gate.resolve({ ok: true, value: { files: [printFile] } });
		await generating;

		const variants = vi
			.mocked(outputPackagingAdapter.package)
			.mock.calls.map(([input]) => input.variants);
		expect(variants).toEqual([['print']]);
	});

	it('surfaces the drift report instead of discarding it', async () => {
		const state = await readyState();
		routes.tools = okTools(PLAIN_VERDICT);
		routes.generate = okGenerate({
			violations: [
				{
					code: 'EXACT_TEXT',
					message: 'The title was reworded.',
					severity: 'error'
				}
			],
			recommendedFixes: [
				{ code: 'RETRY_EXACT', message: 'Ask again with exact text.' }
			]
		});
		await state.requestVerdict({ toolId: 'random_meechie' });
		await state.makePage();
		expect(state.violations).toHaveLength(1);
		expect(state.violations[0].message).toBe('The title was reworded.');
		expect(state.recommendedFixes).toHaveLength(1);
	});

	it('reports a generation error without pretending a page exists', async () => {
		const state = await readyState();
		routes.tools = okTools(PLAIN_VERDICT);
		routes.generate = async () =>
			jsonResponse({
				ok: false,
				error: { code: 'PROVIDER_DOWN', message: 'Provider is down.' }
			});
		await state.requestVerdict({ toolId: 'random_meechie' });
		await state.makePage();
		expect(state.generateError).toBe('Provider is down.');
		expect(state.hasPage).toBe(false);
		expect(state.isGenerating).toBe(false);
	});

	it('discards a page whose verdict was replaced while it was generating', async () => {
		const state = await readyState();
		routes.tools = okTools(STRUCTURED_VERDICT);
		await state.requestVerdict({
			toolId: 'red_flag_or_run',
			situation: 'The first one.'
		});

		const gate = defer<Response>();
		routes.generate = () => gate.promise;
		const generating = state.makePage();
		expect(state.isGenerating).toBe(true);

		// The reader walks away from this verdict while its page is still being built. (A
		// *replacement verdict* can no longer do this — `requestVerdict` refuses while a generation
		// is in flight, precisely so an already-billed page is never discarded — so `reset()` is the
		// path that still reaches this guard.)
		state.reset();

		gate.resolve(jsonResponse({ ok: true, value: generateValue() }));
		await generating;

		expect(state.verdict).toBeNull();
		expect(state.hasPage).toBe(false);
		expect(state.imagePreviews).toEqual([]);
		expect(state.isGenerating).toBe(false);
	});

	it('refuses a replacement verdict while a generation is in flight', async () => {
		// The mirror of the `isWorking` guard on `makePage`. A successful replacement calls
		// `resetPage()`, which would discard a generation the user has already been billed for.
		const state = await readyState();
		routes.tools = okTools(STRUCTURED_VERDICT);
		await state.requestVerdict({
			toolId: 'red_flag_or_run',
			situation: 'The first one.'
		});

		const gate = defer<Response>();
		routes.generate = () => gate.promise;
		const generating = state.makePage();
		expect(state.isGenerating).toBe(true);

		routes.tools = okTools(PLAIN_VERDICT);
		const toolsCallsBefore = fetchCalls.filter(
			(u) => u === '/api/tools'
		).length;
		await expect(
			state.requestVerdict({ toolId: 'random_meechie' })
		).resolves.toBeNull();
		expect(fetchCalls.filter((u) => u === '/api/tools')).toHaveLength(
			toolsCallsBefore
		);
		expect(state.verdict).toEqual(STRUCTURED_VERDICT);

		gate.resolve(jsonResponse({ ok: true, value: generateValue() }));
		await generating;
		expect(state.hasPage).toBe(true);
	});

	it('refuses to start a generation while a replacement verdict is in flight', async () => {
		// Keeping the old verdict on screen during a reload is deliberate, but it left this button
		// live for a verdict about to be discarded — so the click billed a generation whose result
		// the replacement then threw away.
		const state = await withPage(PLAIN_VERDICT);
		state.resetPage();
		const gate = defer<Response>();
		routes.tools = () => gate.promise;

		const pending = state.requestVerdict({ toolId: 'random_meechie' });
		expect(state.isWorking).toBe(true);

		const generateCallsBefore = fetchCalls.filter(
			(url) => url === '/api/generate'
		).length;
		await state.makePage();
		expect(fetchCalls.filter((url) => url === '/api/generate')).toHaveLength(
			generateCallsBefore
		);
		expect(state.isGenerating).toBe(false);

		gate.resolve(jsonResponse({ ok: true, value: STRUCTURED_VERDICT }));
		await pending;
	});

	it('discards a page whose verdict was replaced while it was being packaged', async () => {
		// Packaging is a second, separate window after `/api/generate` has already answered, and it
		// is the slow one — it rasterises the page in a browser canvas. A guard that only checks
		// before packaging leaves this gap wide open, and the abandoned page lands under the new
		// verdict looking perfectly legitimate.
		const state = await readyState();
		routes.tools = okTools(STRUCTURED_VERDICT);
		routes.generate = okGenerate();
		await state.requestVerdict({
			toolId: 'red_flag_or_run',
			situation: 'The first one.'
		});

		const gate = defer<{ ok: true; value: { files: (typeof shareFile)[] } }>();
		vi.mocked(outputPackagingAdapter.package).mockImplementation(
			async (input) =>
				input.variants?.includes('square')
					? gate.promise
					: { ok: true, value: { files: [printFile] } }
		);

		const generating = state.makePage();
		await flush();

		// Abandoned by the reader, not by a replacement verdict: `requestVerdict` now refuses while
		// a generation is in flight, so `reset()` is what still reaches this window.
		state.reset();

		gate.resolve({ ok: true, value: { files: [shareFile] } });
		await generating;

		expect(state.verdict).toBeNull();
		expect(state.hasPage).toBe(false);
		expect(state.imagePreviews).toEqual([]);
		expect(state.packagedFiles).toEqual([]);
	});
});

describe('setDedication', () => {
	it('does nothing extra before a page exists', async () => {
		const state = await readyState();
		state.setDedication('For the group chat.');
		expect(state.dedication).toBe('For the group chat.');
		expect(state.hasPage).toBe(false);
	});

	it('bakes the dedication into the spec it sends', async () => {
		const state = await readyState();
		routes.tools = okTools(PLAIN_VERDICT);
		routes.generate = okGenerate();
		await state.requestVerdict({ toolId: 'random_meechie' });
		state.setDedication('For the group chat');
		await state.makePage();
		const body = JSON.parse(
			(
				vi
					.mocked(fetch)
					.mock.calls.find(
						([url]) => url === '/api/generate'
					)?.[1] as RequestInit
			).body as string
		);
		expect(body.spec.dedication).toBe('For the group chat');
	});

	it('drops an existing page, so the download can never carry a stale dedication', async () => {
		const state = await withPage();
		expect(state.hasPage).toBe(true);
		state.setDedication('Changed my mind');
		expect(state.hasPage).toBe(false);
		expect(state.imagePreviews).toEqual([]);
		expect(state.packagedFiles).toEqual([]);
	});

	it('drops a page that is still generating, not just one already on screen', async () => {
		const state = await readyState();
		routes.tools = okTools(PLAIN_VERDICT);
		await state.requestVerdict({ toolId: 'random_meechie' });

		const gate = defer<Response>();
		routes.generate = () => gate.promise;
		const generating = state.makePage();

		// Nothing is on screen yet, so a check that only looked at previews would let this through
		// and the in-flight page would land under the new dedication.
		state.setDedication('Late edit');
		gate.resolve(jsonResponse({ ok: true, value: generateValue() }));
		await generating;

		expect(state.hasPage).toBe(false);
		expect(state.imagePreviews).toEqual([]);
	});

	it('does not cancel an in-flight verdict request', async () => {
		// The two lifecycles need separate tokens. With one shared token, typing a dedication —
		// which is on screen while a replacement verdict loads — silently killed that request.
		const state = await withPage(PLAIN_VERDICT);
		const gate = defer<Response>();
		routes.tools = () => gate.promise;

		const pending = state.requestVerdict({ toolId: 'random_meechie' });
		state.setDedication('Typed while waiting');
		gate.resolve(jsonResponse({ ok: true, value: STRUCTURED_VERDICT }));
		await pending;

		expect(state.verdict).toEqual(STRUCTURED_VERDICT);
		expect(state.error).toBe('');
	});
});

describe('saveToVault', () => {
	it('writes an owner-scoped record carrying the page bytes and the verdict text', async () => {
		const state = await withPage(STRUCTURED_VERDICT);
		await state.saveToVault();

		expect(state.vaultStatus).toContain('Saved to the vault');
		const record = vi.mocked(creationStoreAdapter.saveCreation).mock.calls[0][0]
			.record as CreationRecord;
		expect(record.owner).toEqual({ kind: 'anonymous', sessionId: 'session-1' });
		expect(record.images).toEqual([{ b64: 'QUJD' }]);
		expect(record.assembledPrompt).toBe('assembled prompt');
		expect(record.revisedPrompt).toBe('revised prompt');
		// Without studioText the reopen path prints the image-generation prompt as Meechie's quote.
		expect(record.studioText?.quote).toBe(STRUCTURED_VERDICT.response);
		expect(record.intent.listMode).toBe('list');
	});

	it('does not record recommended fixes as applied', async () => {
		// The flow never applies a recommendation, so writing them into `fixesApplied` would claim a
		// correction that did not happen. `violations` still carries the drift evidence.
		const state = await readyState();
		routes.tools = okTools(PLAIN_VERDICT);
		routes.generate = okGenerate({
			violations: [
				{
					code: 'EXACT_TEXT',
					message: 'The title was reworded.',
					severity: 'error'
				}
			],
			recommendedFixes: [
				{ code: 'RETRY_EXACT', message: 'Ask again with exact text.' }
			]
		});
		await state.requestVerdict({ toolId: 'random_meechie' });
		await state.makePage();
		await state.saveToVault();

		const record = vi.mocked(creationStoreAdapter.saveCreation).mock.calls[0][0]
			.record as CreationRecord;
		expect(record.fixesApplied).toBeUndefined();
		expect(record.violations).toHaveLength(1);
	});

	it('gives two saves distinct ids even when the clock cannot separate them', async () => {
		// The defect this covers: `crypto.randomUUID` is gated on a secure context, so it is absent
		// over plain HTTP. The old fallback was `creation-${Date.now()}`, and `upsertRecord` drops
		// any existing record with a matching id — so two saves in the same millisecond silently
		// destroyed the first.
		//
		// `Date.now` is frozen deliberately. Without that this test passes against the *broken*
		// fallback too, because the awaits between the two saves advance the real clock past the
		// collision window — proving nothing. Confirmed by restoring the old fallback and watching
		// this fail.
		vi.stubGlobal('crypto', {});
		const clock = vi.spyOn(Date, 'now').mockReturnValue(1_700_000_000_000);
		try {
			const first = await withPage();
			await first.saveToVault();
			const second = await withPage();
			await second.saveToVault();

			const ids = vi
				.mocked(creationStoreAdapter.saveCreation)
				.mock.calls.map(([input]) => (input.record as CreationRecord).id);
			expect(ids).toHaveLength(2);
			expect(ids[0]).not.toEqual(ids[1]);
		} finally {
			clock.mockRestore();
		}
	});

	it('uses crypto.getRandomValues when randomUUID is unavailable', async () => {
		// `getRandomValues` is not secure-context gated, so it covers nearly everything
		// `randomUUID` misses; the clock-mixing last resort should almost never be reached.
		vi.stubGlobal('crypto', {
			getRandomValues: (bytes: Uint8Array) => {
				for (let i = 0; i < bytes.length; i += 1) bytes[i] = i;
				return bytes;
			}
		});
		const state = await withPage();
		await state.saveToVault();

		const record = vi.mocked(creationStoreAdapter.saveCreation).mock.calls[0][0]
			.record as CreationRecord;
		expect(record.id).toMatch(/^creation-[0-9a-f]{32}$/);
	});

	it('stamps createdAtISO from the injected clock, not the wall clock', async () => {
		const state = await withPage();
		state.clock = {
			now: () => 1_700_000_000_000,
			scheduleAt: () => () => {}
		} as ClockSeam;
		await state.saveToVault();

		const record = vi.mocked(creationStoreAdapter.saveCreation).mock.calls[0][0]
			.record as CreationRecord;
		expect(record.createdAtISO).toBe(new Date(1_700_000_000_000).toISOString());
	});

	it('refuses to save while a replacement page is generating', async () => {
		// Since `makePage` stopped clearing the page on entry, page A stays on screen while B
		// generates. Without this guard the Save button is live, and a save started in that window
		// pins A's recipe and images while capturing B's token — and because installing B does not
		// bump the token again, the save's own staleness check passes and it reports "Saved to the
		// vault" under B, having persisted A.
		const state = await withPage(STRUCTURED_VERDICT);
		expect(state.canSaveToVault).toBe(true);

		const gate = defer<Response>();
		routes.generate = () => gate.promise;
		const generating = state.makePage();
		expect(state.isGenerating).toBe(true);

		expect(state.canSaveToVault).toBe(false);
		await state.saveToVault();
		expect(creationStoreAdapter.saveCreation).not.toHaveBeenCalled();

		gate.resolve(jsonResponse({ ok: true, value: generateValue() }));
		await generating;
		expect(state.canSaveToVault).toBe(true);
	});

	it('does nothing when there is no page to save', async () => {
		const state = await readyState();
		await state.saveToVault();
		expect(creationStoreAdapter.saveCreation).not.toHaveBeenCalled();
	});

	it('says the session could not be opened, and does not attempt the write', async () => {
		vi.mocked(sessionAdapter.getSession).mockResolvedValue({
			ok: false,
			error: { code: 'BROWSER_REQUIRED', message: 'no browser' }
		});
		const state = await withPage();
		await state.saveToVault();
		expect(state.vaultStatus).toContain('Could not open your session');
		expect(creationStoreAdapter.saveCreation).not.toHaveBeenCalled();
		expect(state.isSaving).toBe(false);
	});

	it('resolves the session lazily, not in the constructor', async () => {
		// A constructor cannot report an async failure to its caller, so the load moved to the
		// point of use. Nothing should have asked for a session until Save is pressed.
		new VerdictPageState({ fileBaseSlug: 'who-fucked-up' });
		await flush();
		expect(sessionAdapter.getSession).not.toHaveBeenCalled();
	});

	it('retries a session that failed the first time instead of caching the failure', async () => {
		// A browser with site data blocked, then unblocked, must not be stuck for the life of the
		// page. Caching the rejected promise would make every later save repeat the first answer.
		vi.mocked(sessionAdapter.getSession).mockResolvedValueOnce({
			ok: false,
			error: { code: 'BROWSER_REQUIRED', message: 'no browser' }
		});
		const state = await withPage();
		await state.saveToVault();
		expect(state.vaultStatus).toContain('Could not open your session');

		await state.saveToVault();
		expect(state.vaultStatus).toContain('Saved to the vault');
		expect(creationStoreAdapter.saveCreation).toHaveBeenCalledTimes(1);
	});

	it('retries after a session read that threw, not just one that returned an error', async () => {
		// `localStorage` exists but throws SecurityError on access when site data is blocked, so a
		// rejected getSession is reachable. Letting the rejection escape would leave the memo holding
		// a permanently rejected promise that every later save re-awaits and re-throws.
		vi.mocked(sessionAdapter.getSession).mockRejectedValueOnce(
			new Error('SecurityError: access denied')
		);
		const state = await withPage();
		await state.saveToVault();
		expect(state.vaultStatus).toContain('Could not open your session');
		expect(creationStoreAdapter.saveCreation).not.toHaveBeenCalled();

		await state.saveToVault();
		expect(state.vaultStatus).toContain('Saved to the vault');
		expect(creationStoreAdapter.saveCreation).toHaveBeenCalledTimes(1);
	});

	it('shares one session resolve between two saves fired back to back', async () => {
		const state = await withPage();
		await Promise.all([state.saveToVault(), state.saveToVault()]);
		// The second call is refused by the `isSaving` guard, so exactly one resolve and one write.
		expect(sessionAdapter.getSession).toHaveBeenCalledTimes(1);
		expect(creationStoreAdapter.saveCreation).toHaveBeenCalledTimes(1);
	});

	it('surfaces a rejected save rather than reporting success', async () => {
		vi.mocked(creationStoreAdapter.saveCreation).mockResolvedValue({
			ok: false,
			error: { code: 'CREATION_QUOTA', message: 'Vault is full.' }
		});
		const state = await withPage();
		await state.saveToVault();
		expect(state.vaultStatus).toBe('Vault is full.');
	});

	it('does not paint a status over a page the user has already replaced', async () => {
		const state = await withPage();
		const gate = defer<{ ok: true; value: CreationRecord }>();
		vi.mocked(creationStoreAdapter.saveCreation).mockReturnValue(gate.promise);

		const saving = state.saveToVault();
		state.resetPage();
		gate.resolve(savedRecord(STORED_RECORD));
		await saving;

		expect(state.vaultStatus).toBe('');
	});
});

describe('reset', () => {
	it('clears the verdict, the page and the dedication together', async () => {
		const state = await withPage();
		state.setDedication('For him');
		state.reset();
		expect(state.verdict).toBeNull();
		expect(state.dedication).toBe('');
		expect(state.hasPage).toBe(false);
		expect(state.error).toBe('');
		expect(state.isWorking).toBe(false);
		expect(state.isGenerating).toBe(false);
	});
});

describe('copyVerdict', () => {
	it('copies the headline and the response together', async () => {
		const writeText = vi.fn().mockResolvedValue(undefined);
		vi.stubGlobal('navigator', { clipboard: { writeText } });
		const state = await readyState();
		routes.tools = okTools(PLAIN_VERDICT);
		await state.requestVerdict({ toolId: 'random_meechie' });
		await state.copyVerdict();
		expect(writeText).toHaveBeenCalledWith(
			`${PLAIN_VERDICT.headline}\n\n${PLAIN_VERDICT.response}`
		);
		expect(state.copyStatus).toBe('Verdict copied.');
	});

	it('says so when the browser refuses, instead of claiming a copy', async () => {
		vi.stubGlobal('navigator', {
			clipboard: {
				writeText: vi.fn().mockRejectedValue(new Error('denied'))
			}
		});
		const state = await readyState();
		routes.tools = okTools(PLAIN_VERDICT);
		await state.requestVerdict({ toolId: 'random_meechie' });
		await state.copyVerdict();
		expect(state.copyStatus).toBe('Copy unavailable in this browser.');
	});
});
