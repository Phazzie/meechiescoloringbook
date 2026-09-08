// Purpose: Unit tests for `DescribePageState`, the "reader describes a page -> here is that page"
//          lifecycle behind `/describe`.
// Why: This surface spends two separate billable calls, and the whole reason it exists in this
//      shape is that the reader sees the first before paying for the second. Every guard that keeps
//      that true — a failed interpretation not destroying a paid page, a generation refused while
//      an interpretation is in flight, the read-back staying attached to the words it came from —
//      is invisible from the outside and gets a test that fails if it is removed.
// Info flow: stubbed fetch + spied adapters + a driven ClockSeam -> DescribePageState methods ->
//            state assertions.
import { describe, expect, it, vi } from 'vitest';
import { creationStoreAdapter } from '../../src/lib/adapters/creation-store.adapter';
import { outputPackagingAdapter } from '../../src/lib/adapters/output-packaging.adapter';
import { DescribePageState } from '../../src/lib/components/describe-page-state.svelte';
// Shared with `verdict-page-state.test.ts`: both classes extend `PageArtifactState`, so both tests
// need the same stubbed browser, the same provider fixtures and the same adapter spies.
import {
	defer,
	flush,
	generateValue,
	jsonResponse,
	usePageArtifactHarness,
	stubFetchRoutes,
	stubImageDecoder,
	type FetchStub
} from './support/page-artifact-harness';
import { ChatInterpretationResultSchema } from '../../src/lib/seams/chat-interpretation-seam/contract';
import { GenerateResultSchema } from '../../contracts/generate.contract';
import { ColoringPageSpecSchema } from '../../contracts/spec-validation.contract';
import type { ColoringPageSpec } from '../../contracts/spec-validation.contract';
import type { CreationRecord } from '../../contracts/creation-store.contract';
import type { ClockSeam } from '../../src/lib/seams/clock-seam/contract';
import { VAULT_SAVED_CONFIRMATION } from '../../src/lib/core/vault-page';

const A_MESSAGE = 'A page that says I am not doing this again, with roses';

const INTERPRETED: ColoringPageSpec = ColoringPageSpecSchema.parse({
	title: 'I Am Not Doing This Again',
	items: [
		{ number: 1, label: 'Explaining myself twice' },
		{ number: 2, label: 'Waiting on a text back' }
	],
	listMode: 'list',
	alignment: 'left',
	numberAlignment: 'strict',
	listGutter: 'normal',
	whitespaceScale: 50,
	textSize: 'small',
	fontStyle: 'rounded',
	textStrokeWidth: 6,
	colorMode: 'black_and_white_only',
	decorations: 'minimal',
	illustrations: 'simple',
	shading: 'none',
	border: 'plain',
	borderThickness: 8,
	variations: 1,
	outputFormat: 'pdf',
	pageSize: 'US_Letter'
});

const OTHER_INTERPRETED: ColoringPageSpec = ColoringPageSpecSchema.parse({
	...INTERPRETED,
	title: 'Ask Me Again When You Have Receipts',
	listMode: 'title_only',
	items: []
});

const STORED_RECORD: CreationRecord = {
	id: 'creation-1',
	createdAtISO: '2026-09-08T00:00:00.000Z',
	intent: INTERPRETED,
	assembledPrompt: 'assembled prompt',
	owner: { kind: 'anonymous', sessionId: 'session-1' }
};

/** The two endpoints this surface calls, named once so every case reads `routes.interpret`. */
const ENDPOINTS = {
	interpret: '/api/chat-interpretation',
	generate: '/api/generate'
} as const;
type Routes = FetchStub<keyof typeof ENDPOINTS>['routes'];

let routes: Routes;
let fetchCalls: string[];

const stubFetch = (): void => {
	const stub = stubFetchRoutes(ENDPOINTS);
	routes = stub.routes;
	fetchCalls = stub.calls;
};

const okInterpret =
	(spec: ColoringPageSpec = INTERPRETED, headers?: Record<string, string>) =>
	async () =>
		jsonResponse({ ok: true, value: { spec } }, headers ? { headers } : {});

const failInterpret =
	(code: string, message: string, status = 502) =>
	async () =>
		jsonResponse({ ok: false, error: { code, message } }, { status });

const okGenerate =
	(overrides: Record<string, unknown> = {}, headers?: Record<string, string>) =>
	async () =>
		jsonResponse(
			{ ok: true, value: generateValue(overrides) },
			headers ? { headers } : {}
		);

/** The quota header set the rate-limit guard emits on every billable response. */
const quotaHeaders = (
	limit: number,
	remaining: number,
	resetSeconds: number
): Record<string, string> => ({
	'RateLimit-Limit': String(limit),
	'RateLimit-Remaining': String(remaining),
	'RateLimit-Reset': String(resetSeconds)
});

/** A clock whose instant and timers the test states rather than observes. */
type DrivenClock = ClockSeam & { fire: () => void; setNow: (ms: number) => void };
const drivenClock = (startMs = 1_000): DrivenClock => {
	let now = startMs;
	let pending: (() => void) | null = null;
	return {
		now: () => now,
		scheduleAt: (_epochMs, callback) => {
			pending = callback;
			return () => {
				pending = null;
			};
		},
		fire: () => {
			const callback = pending;
			pending = null;
			callback?.();
		},
		setNow: (ms) => {
			now = ms;
		}
	};
};

const newState = (): DescribePageState => {
	const state = new DescribePageState({ formatTime: () => '14:32' });
	state.clock = drivenClock();
	return state;
};

/** Drive a state to "an interpretation is on screen". */
const withReadback = async (
	spec: ColoringPageSpec = INTERPRETED
): Promise<DescribePageState> => {
	const state = newState();
	routes.interpret = okInterpret(spec);
	state.setMessage(A_MESSAGE);
	await state.interpret();
	return state;
};

/** Drive a state to "a page exists", the precondition for the download and save assertions. */
const withPage = async (): Promise<DescribePageState> => {
	const state = await withReadback();
	routes.generate = okGenerate();
	await state.makePage();
	await flush();
	return state;
};

usePageArtifactHarness({ stubFetch, savedRecord: STORED_RECORD });

describe('fixtures', () => {
	it('the stubbed responses actually satisfy the real contracts', () => {
		// If this drifts, every test below passes through a "did not match contract" branch and
		// asserts on the wrong thing.
		expect(
			ChatInterpretationResultSchema.safeParse({
				ok: true,
				value: { spec: INTERPRETED }
			}).success
		).toBe(true);
		expect(
			GenerateResultSchema.safeParse({ ok: true, value: generateValue() }).success
		).toBe(true);
	});
});

describe('asking for an interpretation', () => {
	it('sends the trimmed message to the endpoint nothing in the app had ever called', async () => {
		const state = newState();
		routes.interpret = okInterpret();
		state.setMessage(`   ${A_MESSAGE}   `);
		await state.interpret();

		expect(fetchCalls).toEqual(['/api/chat-interpretation']);
		const body = JSON.parse(
			(vi.mocked(fetch).mock.calls[0][1] as RequestInit).body as string
		);
		expect(body).toEqual({ message: A_MESSAGE });
	});

	it('refuses to spend a call on a message the field already knows is too short', async () => {
		const state = newState();
		state.setMessage('hi');
		await state.interpret();
		expect(fetchCalls).toEqual([]);
		expect(state.canInterpret).toBe(false);
	});

	it('puts the interpretation on screen with the words it came from', async () => {
		const state = await withReadback();
		expect(state.spec).toEqual(INTERPRETED);
		expect(state.interpretedFrom).toBe(A_MESSAGE);
		expect(state.readback?.title).toBe('I Am Not Doing This Again');
	});

	it('keeps the read-back attached to its own words when the box is edited afterwards', async () => {
		// The box stays editable on purpose. Without `interpretedFrom` the panel would appear to
		// describe whatever is typed now, which is a claim about a page nobody asked for.
		const state = await withReadback();
		state.setMessage('something completely different');
		expect(state.interpretedFrom).toBe(A_MESSAGE);
		expect(state.spec).toEqual(INTERPRETED);
	});

	it('translates a contract failure into a sentence, and keeps what was on screen', async () => {
		const state = await withReadback();
		routes.interpret = failInterpret('CHAT_RESPONSE_INVALID', 'no JSON');
		await state.interpret();

		expect(state.interpretError).toContain('not a page');
		// The previous interpretation was paid for. A failed replacement must not destroy it.
		expect(state.spec).toEqual(INTERPRETED);
		expect(state.interpretedFrom).toBe(A_MESSAGE);
	});

	it('keeps a page already paid for when a replacement interpretation fails', async () => {
		const state = await withPage();
		expect(state.hasPage).toBe(true);

		routes.interpret = failInterpret('CHAT_SPEC_INVALID', 'Title too long', 422);
		await state.interpret();

		expect(state.interpretError).toContain('Title too long');
		expect(state.hasPage).toBe(true);
		expect(state.imagePreviews).toHaveLength(1);
	});

	it('drops the page a *successful* replacement interpretation has orphaned', async () => {
		// The one and only place what is on screen stops belonging to what is on screen: the page
		// below was generated from the interpretation this call replaces.
		const state = await withPage();
		routes.interpret = okInterpret(OTHER_INTERPRETED);
		await state.interpret();

		expect(state.spec).toEqual(OTHER_INTERPRETED);
		expect(state.hasPage).toBe(false);
		expect(state.imagePreviews).toEqual([]);
		expect(state.pageExports).toEqual([]);
	});

	it('reports a network failure without inventing a code', async () => {
		const state = newState();
		routes.interpret = async () => {
			throw new Error('Connection reset');
		};
		state.setMessage(A_MESSAGE);
		await state.interpret();
		expect(state.interpretError).toBe('Connection reset');
	});

	it('says so when the answer does not match the contract at all', async () => {
		const state = newState();
		routes.interpret = async () => jsonResponse({ nonsense: true });
		state.setMessage(A_MESSAGE);
		await state.interpret();
		expect(state.interpretError).toContain('could not read');
		expect(state.spec).toBeNull();
	});

	it('captions the read-back with the words that were sent, not the box on arrival', async () => {
		// `message` is live and editable while the request is in flight. Reading it on *arrival*
		// attributes the answer to whatever is in the box a few seconds later, which is exactly the
		// drift `interpretedFrom` exists to stop.
		const state = newState();
		const gate = defer<Response>();
		routes.interpret = () => gate.promise;
		state.setMessage(A_MESSAGE);
		const pending = state.interpret();
		await flush();

		state.setMessage('a completely different page, typed while she was reading');
		gate.resolve(jsonResponse({ ok: true, value: { spec: INTERPRETED } }));
		await pending;

		expect(state.interpretedFrom).toBe(A_MESSAGE);
	});

	it('discards an interpretation the reader walked away from', async () => {
		// `isInterpreting` stops two overlapping requests but not `reset()`. Without a token the
		// answer lands a moment later on a box the reader has just emptied, captioned with nothing.
		const state = newState();
		const gate = defer<Response>();
		routes.interpret = () => gate.promise;
		state.setMessage(A_MESSAGE);
		const pending = state.interpret();
		await flush();

		state.reset();
		gate.resolve(jsonResponse({ ok: true, value: { spec: INTERPRETED } }));
		await pending;

		expect(state.spec).toBeNull();
		expect(state.interpretedFrom).toBe('');
		// The flag is still released, or the button stays disabled until a reload.
		expect(state.isInterpreting).toBe(false);
	});

	it('does not report a failure the reader walked away from', async () => {
		const state = newState();
		const gate = defer<Response>();
		routes.interpret = () => gate.promise.then(() => Promise.reject(new Error('boom')));
		state.setMessage(A_MESSAGE);
		const pending = state.interpret();
		await flush();

		state.reset();
		gate.resolve(jsonResponse({}));
		await pending;

		expect(state.interpretError).toBe('');
		expect(state.isInterpreting).toBe(false);
	});

	it('will not start a second interpretation while one is in flight', async () => {
		const state = newState();
		const gate = defer<Response>();
		routes.interpret = () => gate.promise;
		state.setMessage(A_MESSAGE);
		const first = state.interpret();
		await flush();

		expect(state.canInterpret).toBe(false);
		await state.interpret();
		expect(fetchCalls).toEqual(['/api/chat-interpretation']);

		gate.resolve(jsonResponse({ ok: true, value: { spec: INTERPRETED } }));
		await first;
		expect(state.spec).toEqual(INTERPRETED);
	});
});

describe('the quota the surface reports', () => {
	it('says nothing before the server has reported one', () => {
		expect(newState().quotaMessage).toBe('');
	});

	it('reads the headers off a successful response and prices them per read-back', async () => {
		const state = newState();
		routes.interpret = okInterpret(INTERPRETED, {
			'RateLimit-Limit': '20',
			'RateLimit-Remaining': '5',
			'RateLimit-Reset': '60'
		});
		state.setMessage(A_MESSAGE);
		await state.interpret();
		// Five units, one unit per read-back. Dividing by the studio's two-unit rewrite cost would
		// have said two.
		expect(state.quotaMessage).toContain('5 read-backs left');
	});

	it('reads them off a refusal too, which is when the reader most needs them', async () => {
		const state = newState();
		routes.interpret = async () =>
			jsonResponse(
				{ ok: false, error: { code: 'RATE_LIMITED', message: 'Too many requests.' } },
				{
					status: 429,
					headers: {
						'RateLimit-Limit': '20',
						'RateLimit-Remaining': '0',
						'RateLimit-Reset': '60',
						'Retry-After': '60'
					}
				}
			);
		state.setMessage(A_MESSAGE);
		await state.interpret();

		expect(state.quotaMessage).toContain('desk is full');
		expect(state.interpretError).toContain('desk is full');
	});

	it('stops offering a read-back the server has already said it will refuse', async () => {
		// The sentence beside the button says the desk is full; leaving the button live spends the
		// reader's clicks on requests that are known to be refused, and contradicts that line.
		const state = newState();
		routes.interpret = okInterpret(INTERPRETED, {
			'RateLimit-Limit': '20',
			'RateLimit-Remaining': '0',
			'RateLimit-Reset': '60'
		});
		state.setMessage(A_MESSAGE);
		await state.interpret();

		expect(state.quotaExhausted).toBe(true);
		expect(state.canInterpret).toBe(false);

		await state.interpret();
		expect(fetchCalls).toEqual(['/api/chat-interpretation']);
	});

	it('offers it again the moment the window reopens, without another request', async () => {
		const state = new DescribePageState({ formatTime: () => '14:32' });
		const clock = drivenClock();
		state.clock = clock;
		routes.interpret = okInterpret(INTERPRETED, {
			'RateLimit-Limit': '20',
			'RateLimit-Remaining': '0',
			'RateLimit-Reset': '60'
		});
		state.setMessage(A_MESSAGE);
		await state.interpret();
		expect(state.canInterpret).toBe(false);

		clock.fire();
		expect(state.canInterpret).toBe(true);
	});

	it('stops showing a reading once its own window has closed', async () => {
		const state = new DescribePageState({ formatTime: () => '14:32' });
		const clock = drivenClock();
		state.clock = clock;
		routes.interpret = okInterpret(INTERPRETED, {
			'RateLimit-Limit': '20',
			'RateLimit-Remaining': '1',
			'RateLimit-Reset': '60'
		});
		state.setMessage(A_MESSAGE);
		await state.interpret();
		expect(state.quotaMessage).not.toBe('');

		clock.fire();
		expect(state.quota.text).toBeNull();
		expect(state.quotaMessage).toBe('');
	});
});

describe('turning the interpretation into a page', () => {
	it('will not generate before there is an interpretation to generate from', async () => {
		const state = newState();
		await state.makePage();
		expect(fetchCalls).toEqual([]);
		expect(state.canMakePage).toBe(false);
	});

	it('sends the interpreted spec verbatim, with a hint derived from it', async () => {
		const state = await withPage();
		const generateCall = vi
			.mocked(fetch)
			.mock.calls.find(([url]) => url === '/api/generate');
		const body = JSON.parse((generateCall?.[1] as RequestInit).body as string);
		// The exact object the read-back described. Anything else here and the picture is not the
		// page the reader approved.
		expect(body.spec).toEqual(INTERPRETED);
		expect(body.styleHint).toContain('coloring book page');
		// The subject the spec's enums cannot hold rides in the hint, taken from the words the spec
		// was interpreted from — not from the live box, which is editable after a read-back lands.
		expect(body.styleHint).toContain('with roses');
		expect(state.hasPage).toBe(true);
	});

	it('builds the hint from the interpreted words, not from a box edited since', async () => {
		const state = await withReadback();
		state.setMessage('something else entirely, no roses at all');
		routes.generate = okGenerate();
		await state.makePage();
		await flush();

		const generateCall = vi
			.mocked(fetch)
			.mock.calls.find(([url]) => url === '/api/generate');
		const body = JSON.parse((generateCall?.[1] as RequestInit).body as string);
		expect(body.styleHint).toContain('with roses');
		expect(body.styleHint).not.toContain('something else entirely');
	});

	it('will not generate while an interpretation is in flight', async () => {
		// A successful interpretation calls `resetPage()`, so a generation started in that window
		// is billed and then thrown away.
		const state = await withReadback();
		const gate = defer<Response>();
		routes.interpret = () => gate.promise;
		const pending = state.interpret();
		await flush();

		expect(state.canMakePage).toBe(false);
		await state.makePage();
		expect(fetchCalls.filter((url) => url === '/api/generate')).toEqual([]);

		gate.resolve(jsonResponse({ ok: true, value: { spec: INTERPRETED } }));
		await pending;
	});

	it('offers the print file, the share file and the provider’s own image', async () => {
		const state = await withPage();
		expect(state.pageExports.map((file) => file.kind)).toEqual([
			'print',
			'square',
			'original'
		]);
		expect(state.pageExports.every((file) => file.label.length > 0)).toBe(true);
		expect(state.exportError).toBe('');
	});

	it('names the page after its own title for print and share', async () => {
		const state = await withPage();
		expect(state.pageTitle).toBe(INTERPRETED.title);
		expect(state.pageHeadline).toBe(INTERPRETED.title);
	});

	it('reports a drift check that ran and found nothing, rather than showing nothing', async () => {
		const state = await withPage();
		expect(state.qualityReport.state).toBe('clean');
	});

	it('keeps a good page when a replacement generation returns an unreadable image', async () => {
		const state = await withPage();
		stubImageDecoder(() => false);
		routes.generate = okGenerate();
		await state.makePage();

		expect(state.generateError).toContain('could not be read');
		expect(state.imagePreviews).toHaveLength(1);
		expect(state.hasPage).toBe(true);
	});

	it('reports a packaging failure apart from a generation failure', async () => {
		const state = await withReadback();
		vi.mocked(outputPackagingAdapter.package).mockResolvedValue({
			ok: false,
			error: { code: 'PACKAGING_FAILED', message: 'Canvas unavailable.' }
		});
		routes.generate = okGenerate();
		await state.makePage();
		await flush();

		// The page generated. Writing this into `generateError` would put it in the crimson box
		// above the button that buys another generation, for a failure in a free local render.
		expect(state.hasPage).toBe(true);
		expect(state.generateError).toBe('');
		expect(state.exportError).not.toBe('');
	});
});

describe('keeping a described page', () => {
	it('saves the page, its spec and its images to the vault', async () => {
		const state = await withPage();
		await state.saveToVault();
		await flush();

		expect(state.vaultStatus).toBe(VAULT_SAVED_CONFIRMATION);
		const record = vi.mocked(creationStoreAdapter.saveCreation).mock.calls[0][0]
			.record;
		expect(record.intent).toEqual(INTERPRETED);
		expect(record.images).toEqual([{ b64: 'QUJD' }]);
		expect(record.owner).toEqual({ kind: 'anonymous', sessionId: 'session-1' });
	});

	it('stores no studioText, because Meechie did not say these words', async () => {
		// `MeechieStudioTextOutputSchema` requires a `verdict` string. Putting the reader's own
		// sentence there would claim she said something she never said, and the vault's
		// `warrantForRestoredVerdict` exists to tell those apart.
		const state = await withPage();
		await state.saveToVault();
		await flush();

		const record = vi.mocked(creationStoreAdapter.saveCreation).mock.calls[0][0]
			.record;
		expect(record.studioText).toBeUndefined();
	});

	it('reads the save instant through the clock seam rather than the wall clock', async () => {
		const state = await withPage();
		const clock = drivenClock();
		clock.setNow(Date.UTC(2026, 8, 8, 12, 0, 0));
		state.clock = clock;
		await state.saveToVault();
		await flush();

		const record = vi.mocked(creationStoreAdapter.saveCreation).mock.calls[0][0]
			.record;
		expect(record.createdAtISO).toBe('2026-09-08T12:00:00.000Z');
	});

	it('will not save while a generation is running', async () => {
		const state = await withPage();
		const gate = defer<Response>();
		routes.generate = () => gate.promise;
		const pending = state.makePage();
		await flush();

		expect(state.canSaveToVault).toBe(false);
		await state.saveToVault();
		expect(creationStoreAdapter.saveCreation).not.toHaveBeenCalled();

		gate.resolve(jsonResponse({ ok: true, value: generateValue() }));
		await pending;
	});
});

describe('starting over', () => {
	it('clears the box, the interpretation and the page', async () => {
		const state = await withPage();
		state.reset();

		expect(state.message).toBe('');
		expect(state.spec).toBeNull();
		expect(state.interpretedFrom).toBe('');
		expect(state.hasPage).toBe(false);
		expect(state.imagePreviews).toEqual([]);
	});

	it('puts an example in the box ready to edit, rather than pre-filling the field', async () => {
		const state = newState();
		state.useExample('A page that says something specific');
		expect(state.message).toBe('A page that says something specific');
	});

	it('releases the quota timer when the surface goes away', async () => {
		const state = newState();
		routes.interpret = okInterpret(INTERPRETED, {
			'RateLimit-Limit': '20',
			'RateLimit-Remaining': '5',
			'RateLimit-Reset': '60'
		});
		state.setMessage(A_MESSAGE);
		await state.interpret();

		expect(() => state.dispose()).not.toThrow();
		expect(state.quotaMessage).not.toBe('');
	});
});

// `/api/generate` spends the IMAGE bucket; `/api/chat-interpretation` spends TEXT. Both reach this
// class, and until this change every one of the generate call's headers was discarded — on this
// surface and on the twelve others that reach `/api/generate` through `PageArtifactState`.
describe('the two buckets this surface spends', () => {
	it('records the generate response under the image bucket, not the text one', async () => {
		const state = await withReadback();
		routes.generate = okGenerate({}, quotaHeaders(8, 5, 30));

		await state.makePage();
		await flush();

		expect(state.quota.image).toMatchObject({
			bucket: 'image',
			limit: 8,
			remaining: 5
		});
		// The reading must not have leaked into the bucket the read-back button reports.
		expect(state.quota.text).toBeNull();
	});

	it('keeps a read-back reading and a page reading apart on the same state', async () => {
		const state = newState();
		routes.interpret = okInterpret(INTERPRETED, quotaHeaders(20, 9, 45));
		state.setMessage(A_MESSAGE);
		await state.interpret();

		routes.generate = okGenerate({}, quotaHeaders(8, 6, 20));
		await state.makePage();
		await flush();

		expect(state.quota.text?.limit).toBe(20);
		expect(state.quota.image?.limit).toBe(8);
		// Two sentences, two buckets, two windows.
		expect(state.quotaMessage).toContain('9 read-backs left');
		expect(state.pageQuotaMessage).toContain('6 pages left');
	});

	// The interpreted spec decides what a page costs, because `/api/generate` charges
	// `spec.variations`. A four-picture page out of six remaining units is one page, not six.
	it('prices the page line at the interpretation own variations', async () => {
		const state = await withReadback({ ...INTERPRETED, variations: 4 });
		routes.generate = okGenerate({}, quotaHeaders(8, 6, 20));

		await state.makePage();
		await flush();

		expect(state.pageQuotaMessage).toContain('1 page left');
	});

	// A refusal is exactly when the reader most needs the number: the response that says "too many
	// requests" is also the one carrying the limit and the reset instant.
	it('reads the quota off a refusal, which is when it matters most', async () => {
		const state = await withReadback();
		routes.generate = async () =>
			jsonResponse(
				{
					ok: false,
					error: {
						code: 'RATE_LIMITED',
						message: 'Too many requests. Try again after the current window resets.'
					}
				},
				{ status: 429, headers: { ...quotaHeaders(8, 0, 37), 'Retry-After': '37' } }
			);

		await state.makePage();
		await flush();

		expect(state.quota.image?.exhausted).toBe(true);
		expect(state.pageQuotaMessage).toContain("Meechie's desk is full");
	});
});

// `pictureExhausted` shipped in the first head with no production caller at all: the line said the
// desk was full and every page button stayed live, which is the same screen-versus-server
// disagreement the meter exists to end. These pin the gate to the control AND to the handler.
describe('the page button answers to the image bucket', () => {
	const spentImage = (): Record<string, string> => ({
		'RateLimit-Limit': '8',
		'RateLimit-Remaining': '0',
		'RateLimit-Reset': '25',
		'Retry-After': '25'
	});

	it('refuses the page once the server says the image bucket is spent', async () => {
		const state = await withReadback();
		routes.generate = okGenerate({}, spentImage());

		await state.makePage();
		await flush();

		expect(state.pageQuotaExhausted).toBe(true);
		expect(state.canMakePage).toBe(false);
		expect(state.pageQuotaMessage).toContain("Meechie's desk is full");
	});

	it('does not send a request the server has already said it will refuse', async () => {
		const state = await withReadback();
		routes.generate = okGenerate({}, spentImage());
		await state.makePage();
		await flush();

		const generateCalls = (): string[] =>
			fetchCalls.filter((url) => url === ENDPOINTS.generate);
		const before = generateCalls();
		// The handler, not just the button: a stale render or a keyboard activation reaches this.
		await state.makePage();
		await flush();

		expect(generateCalls()).toHaveLength(before.length);
	});

	// A four-picture page costs four units, so three left is enough for one page and not for this
	// one. The gate has to price the page the reader actually configured.
	it('prices the gate at the interpretation own variations', async () => {
		const state = await withReadback({ ...INTERPRETED, variations: 4 });
		routes.generate = okGenerate({}, {
			'RateLimit-Limit': '8',
			'RateLimit-Remaining': '3',
			'RateLimit-Reset': '25'
		});

		await state.makePage();
		await flush();

		expect(state.pageQuotaExhausted).toBe(true);
		expect(state.canMakePage).toBe(false);
	});

	// `null` means "not known" and must never gate anything.
	it('never blocks on a quota the server has not reported', async () => {
		const state = await withReadback();

		expect(state.pageQuotaExhausted).toBe(false);
		expect(state.canMakePage).toBe(true);
	});
});
