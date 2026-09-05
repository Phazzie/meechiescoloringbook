// Purpose: Unit tests for StudioState page orchestration edge cases.
// Why: Keep extracted studio state behavior aligned with component callback contracts.
// Info flow: StudioState actions -> spec/images/package calls -> assertions.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { creationStoreAdapter } from '../../src/lib/adapters/creation-store.adapter';
import { outputPackagingAdapter } from '../../src/lib/adapters/output-packaging.adapter';
import { sessionAdapter } from '../../src/lib/adapters/session.adapter';
import {
	DEFAULT_STUDIO_TEXT_OUTPUT,
	buildColoringPageSpecFromMeechieText,
	studioThemes
} from '../../src/lib/core/meechie-studio';
import { createMockClockSeam } from '../../src/lib/seams/clock-seam/mock';
import type { ClockSeam } from '../../src/lib/seams/clock-seam/contract';
import { createMockAppOriginSeam } from '../../src/lib/seams/app-origin-seam/mock';
import type { AppOriginSeam } from '../../src/lib/seams/app-origin-seam/contract';
import { createMockPageVisibilitySeam } from '../../src/lib/seams/page-visibility-seam/mock';
import type { MockPageVisibilitySeam } from '../../src/lib/seams/page-visibility-seam/mock';
import { StudioState } from '../../src/routes/studio-state.svelte';
import { VAULT_CAPACITY } from '../../src/lib/core/vault-gallery';
import type { CreationRecord, DraftRecord } from '../../contracts/creation-store.contract';
import type { MeechieStudioTextOutput } from '../../contracts/meechie-studio-text.contract';
import type { Wig } from '../../src/lib/seams/wig-catalog-seam/contract';

const SAMPLE_WIG: Wig = {
	id: 'wig-1',
	name: 'Sample Wig',
	brand: 'Sample Brand',
	affiliateProgram: 'beautyforever',
	affiliateUrl: 'https://example.com/wig-1',
	imageUrl: 'https://example.com/wig-1.jpg',
	priceUsd: 100,
	style: 'straight',
	hairType: 'synthetic',
	length: 'medium',
	color: 'black',
	colorFamily: 'black',
	tags: []
};

const OTHER_WIG: Wig = {
	...SAMPLE_WIG,
	id: 'wig-2',
	name: 'Second Wig'
};

/**
 * Puts a studio on a wig that already has a portrait. `tryOnPortraitUrl` is derived from the
 * portraits made so far and the wig on screen, so a test cannot assign it directly any more —
 * which is the point: it can no longer drift from the wig it is labelled with.
 */
const arrangeTryOnPortrait = (
	studio: StudioState,
	portraitUrl: string,
	wig: Wig = SAMPLE_WIG
): void => {
	studio.selectedWig = wig;
	studio.tryOnPortraits = [{ wig, portraitUrl }];
};

/**
 * Put a studio in the state of having already packaged its page.
 *
 * Arranged through `packageAttempts` — the one stored record — because `packagedFiles`,
 * `pageExports` and `exportError` are all derived from it. Assigning the derived view instead would
 * make the test assert about a value it wrote itself, which is a test that passes whatever the code
 * does.
 */
const arrangePackagedPage = (studio: StudioState): void => {
	studio.packageAttempts = [
		{
			variant: 'print',
			files: [
				{ filename: 'page.pdf', mimeType: 'application/pdf', dataBase64: 'abc' }
			],
			error: null
		}
	];
};

const LEGACY_STUDIO_TEXT_OUTPUT: MeechieStudioTextOutput = {
	verdict: 'Meechie already clocked it.',
	quote: "He said I act like I run the place. I don't act.",
	pageTitle: "I DON'T ACT",
	pageItems: [
		{ number: 1, label: 'RUN THE PLACE' },
		{ number: 2, label: 'DO NOT OPEN THE DOOR' },
		{ number: 3, label: 'LOWER MY VOICE' }
	],
	qualityState: 'ready',
	revisionNote: 'Approved preview line. Generate to get yours.'
};

// The original shipped seed: present from the root commit 4c5660f (2026-05-10) until
// 05dede1 (2026-08-24) replaced it. Drafts saved in that window still carry this text.
const ECONOMY_STUDIO_TEXT_OUTPUT: MeechieStudioTextOutput = {
	verdict: 'Meechie already clocked it.',
	quote: 'You fumbled ME? In THIS economy?',
	pageTitle: 'IN THIS ECONOMY',
	pageItems: [
		{ number: 1, label: 'STAY PRETTY TOMORROW' },
		{ number: 2, label: 'CLOSE THE DOOR' },
		{ number: 3, label: 'LET THE DRAFT WORK' }
	],
	qualityState: 'ready',
	revisionNote: 'Canon Meechie preview.'
};

// A real 1x1 PNG: the vault stores only base64, so restoring a saved page depends on the byte
// signature actually being a PNG, and pdf-lib embeds these bytes for the re-packaging path.
const ONE_PIXEL_PNG_BASE64 =
	'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

const buildSeedSpec = (output: MeechieStudioTextOutput) =>
	buildColoringPageSpecFromMeechieText({
		output,
		pageSize: 'US_Letter',
		border: 'decorative',
		styleHint: 'gold crown ornaments'
	});

// Every initialized StudioState arms a real ClockSeam timer for the next UTC day boundary, and the
// adapter re-arms it every fifteen minutes rather than sleeping until midnight. `restoreAllMocks`
// does not clear a host timer, so an instance left undestroyed keeps its Vitest worker alive until
// the runner forces it down. Initializing through these helpers registers the instance here, and
// the shared teardown below destroys it.
const initializedStudios: StudioState[] = [];

const registerInitialized = (studio: StudioState): StudioState => {
	initializedStudios.push(studio);
	return studio;
};

const destroyInitializedStudios = (): void => {
	while (initializedStudios.length > 0) initializedStudios.pop()?.destroy();
};

const initFromDraft = async (draft: DraftRecord): Promise<StudioState> => {
	localStorage.setItem('cb_drafts_v1', JSON.stringify(draft));
	const studio = new StudioState();
	await studio.init();
	return registerInitialized(studio);
};

afterEach(() => {
	destroyInitializedStudios();
	vi.restoreAllMocks();
});

describe('StudioState', () => {
	it.each([
		['current landlord seed', DEFAULT_STUDIO_TEXT_OUTPUT],
		['pre-#232 I DON\'T ACT seed', LEGACY_STUDIO_TEXT_OUTPUT],
		['pre-#227 IN THIS ECONOMY seed', ECONOMY_STUDIO_TEXT_OUTPUT]
	])('does not restore %s as generated text', async (_label, output) => {
		const studio = await initFromDraft({
			updatedAtISO: '2026-08-26T00:00:00.000Z',
			intent: buildSeedSpec(output)
		});

		expect(studio.textOutput).toBeNull();
	});

	it('always restores explicit studio text even when the intent has the seed title', async () => {
		const explicitText: MeechieStudioTextOutput = {
			verdict: 'Meechie made a new ruling.',
			quote: 'The saved words belong to the user.',
			pageTitle: DEFAULT_STUDIO_TEXT_OUTPUT.pageTitle,
			pageItems: [
				{ number: 1, label: 'EXPLICIT SAVED ITEM' },
				{ number: 2, label: 'SECOND SAVED ITEM' }
			],
			qualityState: 'ready'
		};
		const studio = await initFromDraft({
			updatedAtISO: '2026-08-26T00:00:00.000Z',
			intent: buildSeedSpec(DEFAULT_STUDIO_TEXT_OUTPUT),
			studioText: explicitText
		});

		expect(studio.textOutput).toEqual(explicitText);
	});

	it('restores generated text when a seed title has a changed item', async () => {
		const seedSpec = buildSeedSpec(DEFAULT_STUDIO_TEXT_OUTPUT);
		const studio = await initFromDraft({
			updatedAtISO: '2026-08-26T00:00:00.000Z',
			intent: {
				...seedSpec,
				items: seedSpec.items.map((item, index) =>
					index === 0 ? { ...item, label: 'CHANGED SAVED ITEM' } : item
				)
			}
		});

		expect(studio.textOutput?.pageItems[0].label).toBe('CHANGED SAVED ITEM');
	});

	it('restores generated text when seed item order or footer text changes', async () => {
		const seedSpec = buildSeedSpec(DEFAULT_STUDIO_TEXT_OUTPUT);
		const changedSignatures = [
			{
				...seedSpec,
				items: [...seedSpec.items].reverse()
			},
			{
				...seedSpec,
				footerItem: { number: 97, label: 'CHANGED SAVED FOOTER' }
			},
			{
				...seedSpec,
				footerItem: undefined
			}
		];

		for (const intent of changedSignatures) {
			const studio = await initFromDraft({
				updatedAtISO: '2026-08-26T00:00:00.000Z',
				intent
			});

			expect(studio.textOutput).not.toBeNull();
		}
	});

	it('restores generated text when the IN THIS ECONOMY seed has a changed item', async () => {
		const seedSpec = buildSeedSpec(ECONOMY_STUDIO_TEXT_OUTPUT);
		const studio = await initFromDraft({
			updatedAtISO: '2026-08-26T00:00:00.000Z',
			intent: {
				...seedSpec,
				items: seedSpec.items.map((item, index) =>
					index === 1 ? { ...item, label: 'SLAM THE DOOR' } : item
				)
			}
		});

		expect(studio.textOutput).not.toBeNull();
		expect(studio.textOutput?.pageItems[1].label).toBe('SLAM THE DOOR');
	});

	it('does not treat evidence or setting changes alone as generated text', async () => {
		const seedSpec = buildSeedSpec(DEFAULT_STUDIO_TEXT_OUTPUT);
		const studio = await initFromDraft({
			updatedAtISO: '2026-08-26T00:00:00.000Z',
			intent: {
				...seedSpec,
				pageSize: 'A4',
				border: 'plain',
				dedication: 'For Big Sis'
			},
			chatMessage: 'Evidence was entered without generating text.'
		});

		expect(studio.textOutput).toBeNull();
		expect(studio.evidence).toBe('Evidence was entered without generating text.');
		expect(studio.pageSize).toBe('A4');
		expect(studio.border).toBe('plain');
		expect(studio.dedication).toBe('For Big Sis');
	});

	it('updates the active mode when a mode card is selected', () => {
		const studio = new StudioState();
		const targetMode = studio.weeklyModes.find((mode) => mode.id !== studio.activeModeId);
		expect(targetMode).toBeDefined();

		studio.handleModeSelect(targetMode!.id);

		expect(studio.activeModeId).toBe(targetMode!.id);
		expect(studio.activeMode.label).toBe(targetMode!.label);
	});

	it('clears the previous mode\'s AI text output when a different mode card is selected', () => {
		const studio = new StudioState();
		studio.textOutput = DEFAULT_STUDIO_TEXT_OUTPUT;
		const targetMode = studio.weeklyModes.find((mode) => mode.id !== studio.activeModeId);
		expect(targetMode).toBeDefined();

		studio.handleModeSelect(targetMode!.id);

		expect(studio.textOutput).toBeNull();
	});

	it('preserves the current AI text output when the already-active mode card is reselected', () => {
		const studio = new StudioState();
		studio.textOutput = DEFAULT_STUDIO_TEXT_OUTPUT;

		studio.handleModeSelect(studio.activeModeId);

		expect(studio.textOutput).toEqual(DEFAULT_STUDIO_TEXT_OUTPUT);
	});

	it('preserves a previously generated coloring page when the already-active mode card is reselected', () => {
		const studio = new StudioState();
		studio.images = [
			{ id: 'image-1', format: 'png', mimeType: 'image/png', data: 'abc', encoding: 'base64' }
		];
		arrangePackagedPage(studio);
		studio.assembledPrompt = 'assembled prompt';

		studio.handleModeSelect(studio.activeModeId);

		expect(studio.images).not.toEqual([]);
		expect(studio.packagedFiles).not.toEqual([]);
		expect(studio.assembledPrompt).toBe('assembled prompt');
	});

	it('replaces a previously generated page with the loaded creation, keeping nothing stale', async () => {
		const studio = new StudioState();
		studio.images = [
			{ id: 'image-1', format: 'png', mimeType: 'image/png', data: 'abc', encoding: 'base64' }
		];
		arrangePackagedPage(studio);
		studio.assembledPrompt = 'stale assembled prompt';
		studio.revisedPrompt = 'stale revised prompt';
		studio.generationError = 'stale error';

		const creation: CreationRecord = {
			id: 'creation-1',
			createdAtISO: '2026-09-03T00:00:00.000Z',
			intent: buildSeedSpec(DEFAULT_STUDIO_TEXT_OUTPUT),
			assembledPrompt: 'a different creation entirely',
			owner: { kind: 'anonymous', sessionId: 'session-1' }
		};

		await studio.loadCreation(creation);

		// The record stored no images, so there is nothing to bring back.
		expect(studio.images).toEqual([]);
		expect(studio.packagedFiles).toEqual([]);
		// The trace now belongs to the creation that was opened, not the one before it.
		expect(studio.assembledPrompt).toBe('a different creation entirely');
		expect(studio.revisedPrompt).toBe('');
		expect(studio.generationError).toBe('');
	});

	it('brings the saved picture back when a creation with stored images is reopened', async () => {
		const studio = new StudioState();
		const packageSpy = vi
			.spyOn(outputPackagingAdapter, 'package')
			.mockImplementation(async (input) => ({
				ok: true,
				value: {
					files: [
						input.variants?.[0] === 'square'
							? {
									filename: 'saved-square.png',
									mimeType: 'image/png',
									dataBase64: 'c3F1YXJl'
								}
							: {
									filename: 'saved.pdf',
									mimeType: 'application/pdf',
									dataBase64: 'cGRm'
								}
					]
				}
			}));

		const creation: CreationRecord = {
			id: 'creation-with-image',
			createdAtISO: '2026-09-03T00:00:00.000Z',
			intent: buildSeedSpec(DEFAULT_STUDIO_TEXT_OUTPUT),
			assembledPrompt: 'the saved prompt',
			images: [{ b64: ONE_PIXEL_PNG_BASE64 }],
			owner: { kind: 'anonymous', sessionId: 'session-1' }
		};

		await studio.loadCreation(creation);

		expect(studio.images).toEqual([
			{
				id: 'creation-with-image-saved-1',
				format: 'png',
				mimeType: 'image/png',
				data: ONE_PIXEL_PNG_BASE64,
				encoding: 'base64'
			}
		]);
		expect(studio.imagePreviews[0]).toBe(`data:image/png;base64,${ONE_PIXEL_PNG_BASE64}`);
		// A reopened page gets the same downloads a freshly generated one does — printable and
		// share — instead of sitting on a disabled button.
		expect(packageSpy.mock.calls.map((call) => call[0].variants)).toEqual([
			['print'],
			['square']
		]);
		expect(studio.packagedFiles).toEqual([
			{ filename: 'saved.pdf', mimeType: 'application/pdf', dataBase64: 'cGRm' },
			{ filename: 'saved-square.png', mimeType: 'image/png', dataBase64: 'c3F1YXJl' }
		]);
		// Including the provider's own bytes, named after the same page as the rest.
		expect(studio.pageExports.map((item) => item.kind)).toEqual([
			'print',
			'square',
			'original'
		]);
		expect(studio.exportError).toBe('');
	});

	it('discards a stale packaging result when another page is opened first', async () => {
		const studio = new StudioState();
		let releaseFirstPackaging: (() => void) | null = null;
		// Named per variant as well as per page, so the assertions below read as "these are the
		// second page's downloads" rather than as a count.
		vi.spyOn(outputPackagingAdapter, 'package').mockImplementation(async (input) => {
			const variant = input.variants?.[0] ?? 'print';
			if (!releaseFirstPackaging) {
				await new Promise<void>((resolve) => {
					releaseFirstPackaging = resolve;
				});
				return {
					ok: true,
					value: {
						files: [
							{
								filename: `first-${variant}.pdf`,
								mimeType: 'application/pdf',
								dataBase64: 'Zmlyc3Q='
							}
						]
					}
				};
			}
			return {
				ok: true,
				value: {
					files: [
						{
							filename: `second-${variant}.pdf`,
							mimeType: 'application/pdf',
							dataBase64: 'c2Vjb25k'
						}
					]
				}
			};
		});

		const secondPageFiles = [
			{ filename: 'second-print.pdf', mimeType: 'application/pdf', dataBase64: 'c2Vjb25k' },
			{ filename: 'second-square.pdf', mimeType: 'application/pdf', dataBase64: 'c2Vjb25k' }
		];

		const makeSaved = (id: string): CreationRecord => ({
			id,
			createdAtISO: '2026-09-03T00:00:00.000Z',
			intent: buildSeedSpec(DEFAULT_STUDIO_TEXT_OUTPUT),
			assembledPrompt: `prompt for ${id}`,
			images: [{ b64: ONE_PIXEL_PNG_BASE64 }],
			owner: { kind: 'anonymous', sessionId: 'session-1' }
		});

		// First page's packaging is still in flight...
		const firstLoad = studio.loadCreation(makeSaved('first-page'));
		await vi.waitFor(() => expect(releaseFirstPackaging).not.toBeNull());

		// ...when the reader opens a second page, which packages immediately.
		await studio.loadCreation(makeSaved('second-page'));
		expect(studio.packagedFiles).toEqual(secondPageFiles);

		// The late first result must not replace what is now on screen.
		releaseFirstPackaging!();
		await firstLoad;

		expect(studio.packagedFiles).toEqual(secondPageFiles);
	});

	it('leaves a reopened page usable when re-packaging the saved image fails', async () => {
		const studio = new StudioState();
		vi.spyOn(outputPackagingAdapter, 'package').mockRejectedValue(new Error('no canvas'));

		await studio.loadCreation({
			id: 'creation-unpackageable',
			createdAtISO: '2026-09-03T00:00:00.000Z',
			intent: buildSeedSpec(DEFAULT_STUDIO_TEXT_OUTPUT),
			assembledPrompt: 'the saved prompt',
			images: [{ b64: ONE_PIXEL_PNG_BASE64 }],
			owner: { kind: 'anonymous', sessionId: 'session-1' }
		});

		expect(studio.images).toHaveLength(1);
		expect(studio.packagedFiles).toEqual([]);
		// Not a generation failure: the page is on the paper and still previews, exports as the
		// provider's own image, and saves to the vault.
		expect(studio.generationError).toBe('');
		expect(studio.pageExports.map((item) => item.kind)).toEqual(['original']);
		// And it says so, rather than leaving a dead button with no reason — which is what the
		// reopen path's own near-copy of the packaging code used to do.
		expect(studio.exportError).toBe(
			'Your page is on the paper. The printable download could not be built: no canvas. ' +
				'The square share image could not be built: no canvas.'
		);
	});

	it('applies the dedication input value before validation and schedules draft save', () => {
		const studio = new StudioState();
		const scheduleDraftSave = vi.fn();
		studio.dedication = '';
		studio.scheduleDraftSave = scheduleDraftSave;

		(studio.handleDedicationInput as (value: string) => void)('  Big Sis  ');

		expect(studio.dedication).toBe('  Big Sis  ');
		expect(studio.spec.dedication).toBe('Big Sis');
		expect(scheduleDraftSave).toHaveBeenCalledOnce();
	});

	it('clears a previously generated coloring page when a new try-on is requested', async () => {
		const studio = new StudioState();
		studio.selectedWig = SAMPLE_WIG;
		studio.selfieBase64 = 'selfie-bytes';
		studio.images = [
			{ id: 'image-1', format: 'png', mimeType: 'image/png', data: 'abc', encoding: 'base64' }
		];
		arrangePackagedPage(studio);
		studio.generationError = 'stale error';
		studio.assembledPrompt = 'stale assembled prompt';
		studio.revisedPrompt = 'stale revised prompt';
		studio.violations = [{ code: 'stale-violation', message: 'stale', severity: 'warning' }];
		studio.recommendedFixes = [{ code: 'stale-violation', message: 'stale fix' }];

		const mockResponse = new Response(
			JSON.stringify({
				ok: true,
				value: { portraitBase64: 'ZmFrZQ==', portraitMimeType: 'image/png' }
			}),
			{ status: 200, statusText: 'OK' }
		);
		vi.stubGlobal('fetch', vi.fn().mockResolvedValue(mockResponse));

		await studio.handleWigTryOn();

		expect(studio.images).toEqual([]);
		expect(studio.packagedFiles).toEqual([]);
		expect(studio.generationError).toBe('');
		expect(studio.assembledPrompt).toBe('');
		expect(studio.revisedPrompt).toBe('');
		expect(studio.violations).toEqual([]);
		expect(studio.recommendedFixes).toEqual([]);
		expect(studio.tryOnPortraitUrl).toBe('data:image/png;base64,ZmFrZQ==');

		vi.unstubAllGlobals();
	});

	it('preserves the current try-on portrait and coloring page when the already-selected wig card is reselected', async () => {
		const studio = new StudioState();
		arrangeTryOnPortrait(studio, 'data:image/png;base64,ZmFrZQ==');
		studio.images = [
			{ id: 'image-1', format: 'png', mimeType: 'image/png', data: 'abc', encoding: 'base64' }
		];
		arrangePackagedPage(studio);

		await studio.selectWigForTryOn(SAMPLE_WIG);

		expect(studio.tryOnPortraitUrl).toBe('data:image/png;base64,ZmFrZQ==');
		expect(studio.images).not.toEqual([]);
		expect(studio.packagedFiles).not.toEqual([]);
	});

	it('previews a JPEG try-on portrait with the IANA image/jpeg media type', async () => {
		const studio = new StudioState();
		vi.spyOn(outputPackagingAdapter, 'package').mockResolvedValue({
			ok: true,
			value: { files: [] }
		});
		arrangeTryOnPortrait(studio, 'data:image/jpeg;base64,/9j/4AAQ');

		await studio.handleGenerateTryOnPage();

		expect(studio.images[0]?.format).toBe('jpg');
		expect(studio.imagePreviews[0]).toBe('data:image/jpeg;base64,/9j/4AAQ');
	});

	it('preserves WebP try-on portraits as WebP images for packaging', async () => {
		const studio = new StudioState();
		const packageSpy = vi.spyOn(outputPackagingAdapter, 'package').mockResolvedValue({
			ok: true,
			value: { files: [] }
		});
		arrangeTryOnPortrait(studio, 'data:image/webp;base64,d2VicA==');

		await studio.handleGenerateTryOnPage();

		// Both variants get the same untranscoded WebP bytes.
		expect(packageSpy.mock.calls.map((call) => call[0].variants)).toEqual([
			['print'],
			['square']
		]);
		for (const [input] of packageSpy.mock.calls) {
			expect(input.images[0]).toMatchObject({
				format: 'webp',
				mimeType: 'image/webp',
				data: 'd2VicA==',
				encoding: 'base64'
			});
		}
	});
});

describe('StudioState try-on draft provenance', () => {
	const tryOnDraftIntent = () => ({
		...buildSeedSpec(DEFAULT_STUDIO_TEXT_OUTPUT),
		title: 'WIG TRY-ON - SAMPLE WIG',
		listMode: 'title_only' as const,
		items: [],
		footerItem: undefined
	});

	/**
	 * A try-on page prints a wig's name and a picture. Its title matches no seed signature, so the
	 * draft restore used to rebuild a verdict for it — and the only text the schema allows for a
	 * page with no items is the demo seed's. Those words then sat on the paper as the page's list.
	 */
	it('restores no verdict for a try-on draft rather than inventing the seed', async () => {
		const restored = await initFromDraft({
			updatedAtISO: '2026-09-05T00:00:00.000Z',
			intent: tryOnDraftIntent()
		});

		expect(restored.textOutput).toBeNull();
		// The panel reads this, so an invented verdict would have printed THE RENT / THE DOPEMAN
		// under the wig's name.
		expect(restored.previewOutput).toBeNull();
		// And Save to Vault would have been lit up by it, over a draft that carries no portrait.
		expect(restored.canSaveToVault).toBe(false);
	});

	/**
	 * The rebuild that runs on every Page Control change describes the verdict, and this page has
	 * none. Falling back to the seed retitled the reader's page THE LANDLORD on a page-size change.
	 */
	it('keeps a restored try-on page its own title when a setting changes', async () => {
		const restored = await initFromDraft({
			updatedAtISO: '2026-09-05T00:00:00.000Z',
			intent: tryOnDraftIntent()
		});

		await restored.syncSpecFromCurrentText();

		expect(restored.spec.title).toBe('WIG TRY-ON - SAMPLE WIG');
		expect(restored.spec.listMode).toBe('title_only');
		expect(restored.spec.items).toEqual([]);
	});

	it('does not write invented seed text into the draft it saves back', async () => {
		const saveDraftSpy = vi.spyOn(creationStoreAdapter, 'saveDraft');
		const restored = await initFromDraft({
			updatedAtISO: '2026-09-05T00:00:00.000Z',
			intent: tryOnDraftIntent()
		});

		saveDraftSpy.mockClear();
		await restored.syncSpecFromCurrentText();
		await vi.waitFor(() => expect(saveDraftSpy).toHaveBeenCalled());

		const written = saveDraftSpy.mock.calls.at(-1)?.[0].draft;
		expect(written?.studioText).toBeUndefined();
	});
});

describe('StudioState wig try-on comparison', () => {
	const PNG_PORTRAIT = 'data:image/png;base64,ZmFrZQ==';
	const OTHER_PORTRAIT = 'data:image/png;base64,b3RoZXI=';

	const portraitResponse = (base64: string): Response =>
		new Response(
			JSON.stringify({
				ok: true,
				value: { portraitBase64: base64, portraitMimeType: 'image/png' }
			}),
			{ status: 200, statusText: 'OK' }
		);

	/**
	 * Starts a try-on for SAMPLE_WIG on a first selfie, runs `interrupt` while the request is still
	 * in flight, and only then lets the response land.
	 *
	 * That window is the whole subject of the staleness tests below. A try-on is slow enough for the
	 * reader to change either input under it, and a late result used to attach itself to whatever
	 * was on screen when it arrived — so both interruptions are exercised through one helper: they
	 * differ only in which input moves.
	 */
	const tryOnInterruptedBy = async (
		studio: StudioState,
		interrupt: (_studio: StudioState) => void,
		response: Response
	): Promise<void> => {
		studio.selectedWig = SAMPLE_WIG;
		studio.setSelfieForTryOn('first-selfie', 'image/png');
		let release: (value: Response) => void = () => {};
		const pending = new Promise<Response>((resolve) => {
			release = resolve;
		});
		vi.stubGlobal('fetch', vi.fn().mockReturnValue(pending));

		const inFlight = studio.handleWigTryOn();
		interrupt(studio);
		release(response);
		await inFlight;
	};

	const selectOtherWig = (studio: StudioState): void => {
		studio.selectedWig = OTHER_WIG;
	};

	const uploadAnotherSelfie = (studio: StudioState): void => {
		studio.setSelfieForTryOn('second-selfie', 'image/png');
	};

	const failedTryOnResponse = (): Response =>
		new Response(
			JSON.stringify({
				ok: false,
				error: { code: 'WIG_TRY_ON_FAILED', message: 'Styling failed.' }
			}),
			{ status: 200, statusText: 'OK' }
		);

	it('keeps the previous wig\'s portrait when another wig is selected, and shows it again on return', async () => {
		const studio = new StudioState();
		studio.selfieBase64 = 'selfie-bytes';
		studio.tryOnPortraits = [{ wig: SAMPLE_WIG, portraitUrl: PNG_PORTRAIT }];
		studio.selectedWig = SAMPLE_WIG;
		expect(studio.tryOnPortraitUrl).toBe(PNG_PORTRAIT);

		await studio.selectWigForTryOn(OTHER_WIG);

		// The other wig has no portrait yet, so the result panel is empty for it...
		expect(studio.tryOnPortraitUrl).toBe('');
		// ...but the first wig's portrait was not destroyed, which is what made comparing two
		// wigs impossible.
		expect(studio.tryOnPortraits).toHaveLength(1);

		await studio.selectWigForTryOn(SAMPLE_WIG);

		expect(studio.tryOnPortraitUrl).toBe(PNG_PORTRAIT);
	});

	it('drops every portrait when a new selfie is uploaded, because they are all of the old face', () => {
		const studio = new StudioState();
		studio.selectedWig = SAMPLE_WIG;
		studio.tryOnPortraits = [
			{ wig: SAMPLE_WIG, portraitUrl: PNG_PORTRAIT },
			{ wig: OTHER_WIG, portraitUrl: OTHER_PORTRAIT }
		];

		studio.setSelfieForTryOn('new-selfie-bytes', 'image/png');

		expect(studio.tryOnPortraits).toEqual([]);
		expect(studio.tryOnPortraitUrl).toBe('');
	});

	it('shows the compare strip only once there are two looks to choose between', () => {
		const studio = new StudioState();
		expect(studio.canCompareTryOns).toBe(false);
		studio.tryOnPortraits = [{ wig: SAMPLE_WIG, portraitUrl: PNG_PORTRAIT }];
		expect(studio.canCompareTryOns).toBe(false);
		studio.tryOnPortraits = [
			{ wig: SAMPLE_WIG, portraitUrl: PNG_PORTRAIT },
			{ wig: OTHER_WIG, portraitUrl: OTHER_PORTRAIT }
		];
		expect(studio.canCompareTryOns).toBe(true);
	});

	it('files a late portrait under the wig it was requested for, not the wig now on screen', async () => {
		const studio = new StudioState();

		await tryOnInterruptedBy(studio, selectOtherWig, portraitResponse('ZmFrZQ=='));

		expect(studio.tryOnPortraits).toEqual([{ wig: SAMPLE_WIG, portraitUrl: PNG_PORTRAIT }]);
		// The wig on screen never had a portrait made, so it must not be wearing someone else's.
		expect(studio.tryOnPortraitUrl).toBe('');

		vi.unstubAllGlobals();
	});

	it('does not show a try-on failure for a wig the reader has already moved off', async () => {
		const studio = new StudioState();

		await tryOnInterruptedBy(studio, selectOtherWig, failedTryOnResponse());

		expect(studio.tryOnError).toBe('');

		vi.unstubAllGlobals();
	});

	it('still shows a try-on failure for the wig that is on screen', async () => {
		const studio = new StudioState();
		studio.selectedWig = SAMPLE_WIG;
		studio.selfieBase64 = 'selfie-bytes';
		vi.stubGlobal('fetch', vi.fn().mockResolvedValue(failedTryOnResponse()));

		await studio.handleWigTryOn();

		expect(studio.tryOnError).toBe('Styling failed.');

		vi.unstubAllGlobals();
	});

	it('replaces a re-tried wig in place, so the compare strip does not reshuffle', async () => {
		const studio = new StudioState();
		studio.selfieBase64 = 'selfie-bytes';
		studio.tryOnPortraits = [
			{ wig: SAMPLE_WIG, portraitUrl: PNG_PORTRAIT },
			{ wig: OTHER_WIG, portraitUrl: OTHER_PORTRAIT }
		];
		studio.selectedWig = SAMPLE_WIG;
		vi.stubGlobal('fetch', vi.fn().mockResolvedValue(portraitResponse('cmVkb25l')));

		await studio.handleWigTryOn();

		expect(studio.tryOnPortraits.map((entry) => entry.wig.id)).toEqual([
			SAMPLE_WIG.id,
			OTHER_WIG.id
		]);
		expect(studio.tryOnPortraits[0].portraitUrl).toBe('data:image/png;base64,cmVkb25l');

		vi.unstubAllGlobals();
	});

	it('drops a portrait whose selfie was replaced while it was still being made', async () => {
		const studio = new StudioState();

		// Replacing the photo mid-flight clears the portraits precisely because they are of the old
		// face, so the in-flight result must not put one straight back — it would sit in the compare
		// strip beside portraits of the new face as though they were the same person.
		await tryOnInterruptedBy(studio, uploadAnotherSelfie, portraitResponse('ZmFrZQ=='));

		expect(studio.tryOnPortraits).toEqual([]);
		expect(studio.tryOnPortraitUrl).toBe('');

		vi.unstubAllGlobals();
	});

	it('does not show a try-on failure for a selfie the reader has already replaced', async () => {
		const studio = new StudioState();

		await tryOnInterruptedBy(studio, uploadAnotherSelfie, failedTryOnResponse());

		expect(studio.tryOnError).toBe('');

		vi.unstubAllGlobals();
	});

	it('still files a portrait when the selfie was never replaced', async () => {
		const studio = new StudioState();
		studio.selectedWig = SAMPLE_WIG;
		studio.setSelfieForTryOn('only-selfie', 'image/png');
		vi.stubGlobal('fetch', vi.fn().mockResolvedValue(portraitResponse('ZmFrZQ==')));

		await studio.handleWigTryOn();

		expect(studio.tryOnPortraitUrl).toBe(PNG_PORTRAIT);

		vi.unstubAllGlobals();
	});

	it('abandons a try-on page when the reader picks another wig while it is being built', async () => {
		const studio = new StudioState();
		vi.spyOn(outputPackagingAdapter, 'package').mockResolvedValue({
			ok: true,
			value: { files: [] }
		});
		studio.tryOnPortraits = [
			{ wig: SAMPLE_WIG, portraitUrl: PNG_PORTRAIT },
			{ wig: OTHER_WIG, portraitUrl: OTHER_PORTRAIT }
		];
		studio.selectedWig = SAMPLE_WIG;

		const inFlight = studio.handleGenerateTryOnPage();
		// The carousel stays live during generation, so this is reachable.
		await studio.selectWigForTryOn(OTHER_WIG);
		await inFlight;

		// The page asked for was the first wig's. Rather than package the second wig's portrait
		// under the first wig's name, or show the first wig's page while the second is selected,
		// the operation is abandoned.
		expect(studio.images).toEqual([]);
		expect(studio.spec.title).not.toBe('Wig Try-On - Sample Wig');
	});

	/**
	 * The fifth instance of this branch's recurring bug, found by auditing for the pattern rather
	 * than by being told: packaging is an await too, so its result needs the same token check the
	 * portrait read got.
	 */
	/**
	 * The sixth instance, and the only one in code this branch did not write: the home studio's
	 * normal generation had no staleness guard at all, so a slow provider response landed its
	 * prompt, images and PDF on whatever verdict was on screen when it finished. The mode routes
	 * already guard this; the studio did not. One line, in a path proven to have the same bug.
	 */
	it('does not land a slow generation on a page the reader has already replaced', async () => {
		const studio = new StudioState();
		studio.textOutput = { ...DEFAULT_STUDIO_TEXT_OUTPUT };
		let releaseGenerate: (value: Response) => void = () => {};
		const fetchSpy = vi.fn().mockReturnValue(
			new Promise<Response>((resolve) => {
				releaseGenerate = resolve;
			})
		);
		vi.stubGlobal('fetch', fetchSpy);

		const inFlight = studio.handleGeneratePage();
		for (let i = 0; i < 100 && fetchSpy.mock.calls.length === 0; i++) {
			await Promise.resolve();
		}
		expect(fetchSpy).toHaveBeenCalledOnce();

		// Switching mode clears the page and advances the token, exactly as a new verdict would.
		studio.handleModeSelect(studio.weeklyModes[1].id);
		releaseGenerate(
			new Response(
				JSON.stringify({
					ok: true,
					value: {
						prompt: 'a stale prompt',
						templateVersion: 'v2',
						images: [
							{
								id: 'stale-1',
								format: 'png',
								mimeType: 'image/png',
								data: 'c3RhbGU=',
								encoding: 'base64'
							}
						],
						violations: [],
						recommendedFixes: []
					}
				}),
				{ status: 200, statusText: 'OK' }
			)
		);
		await inFlight;

		expect(studio.images).toEqual([]);
		expect(studio.assembledPrompt).toBe('');
		// The guard returned; nothing failed. Without it the payload parses cleanly and lands.
		expect(studio.generationError).toBe('');

		vi.unstubAllGlobals();
	});

	it('does not attach a late try-on PDF to a page the reader has moved off', async () => {
		const studio = new StudioState();
		const STALE_PDF = {
			filename: 'stale.pdf',
			mimeType: 'application/pdf',
			dataBase64: 'AAA'
		};
		let releasePackaging: (value: {
			ok: true;
			value: { files: (typeof STALE_PDF)[] };
		}) => void = () => {};
		const packageSpy = vi.spyOn(outputPackagingAdapter, 'package').mockReturnValue(
			new Promise((resolve) => {
				releasePackaging = resolve as typeof releasePackaging;
			})
		);
		studio.tryOnPortraits = [
			{ wig: SAMPLE_WIG, portraitUrl: PNG_PORTRAIT },
			{ wig: OTHER_WIG, portraitUrl: OTHER_PORTRAIT }
		];
		studio.selectedWig = SAMPLE_WIG;

		const inFlight = studio.handleGenerateTryOnPage();
		// Wait until packaging has actually been entered, so the switch below lands *after* the
		// earlier token check and can only be caught by the one guarding the packaging result.
		for (let i = 0; i < 100 && packageSpy.mock.calls.length === 0; i++) {
			await Promise.resolve();
		}
		expect(packageSpy).toHaveBeenCalledOnce();

		await studio.selectWigForTryOn(OTHER_WIG);
		// A distinguishable payload: without the guard this lands on the page the reader is now
		// looking at, so Download PDF would hand back the wig they moved off.
		releasePackaging({ ok: true, value: { files: [STALE_PDF] } });
		await inFlight;

		expect(studio.packagedFiles).toEqual([]);
	});

	/**
	 * Trying the same wig on again keeps the old portrait on screen while the new one is styled.
	 * Replacing it changes neither the selected wig nor the page token, so neither existing guard
	 * can see it — a page started in that window would keep the old look while the panel shows the
	 * new one. The only thing that distinguishes the window is that a try-on is in flight.
	 */
	it('refuses to build a page while the portrait it would use is being replaced', async () => {
		const studio = new StudioState();
		const packageSpy = vi.spyOn(outputPackagingAdapter, 'package').mockResolvedValue({
			ok: true,
			value: { files: [] }
		});
		studio.tryOnPortraits = [{ wig: SAMPLE_WIG, portraitUrl: PNG_PORTRAIT }];
		studio.selectedWig = SAMPLE_WIG;
		studio.selfieBase64 = 'selfie-bytes';
		expect(studio.canGenerateTryOnPage).toBe(true);

		// The same wig is being tried on again; the old portrait is still on screen.
		studio.isTryingOn = true;
		expect(studio.canGenerateTryOnPage).toBe(false);

		await studio.handleGenerateTryOnPage();

		expect(packageSpy).not.toHaveBeenCalled();
		expect(studio.images).toEqual([]);
		expect(studio.generationError).toBe(
			'Wait for the new look to finish before making the page.'
		);
	});

	it('names a try-on coloring page after its wig instead of the demo default', async () => {
		const studio = new StudioState();
		vi.spyOn(outputPackagingAdapter, 'package').mockResolvedValue({
			ok: true,
			value: { files: [] }
		});
		// No verdict has ever been generated, so the spec still carries the seed title.
		expect(studio.spec.title).toBe(DEFAULT_STUDIO_TEXT_OUTPUT.pageTitle);
		arrangeTryOnPortrait(studio, PNG_PORTRAIT);

		await studio.handleGenerateTryOnPage();

		expect(studio.spec.title).toBe('Wig Try-On - Sample Wig');
		expect(studio.assembledPrompt).toContain(SAMPLE_WIG.name);
	});

	/**
	 * Replacing only the title left the demo seed's list on the record. A try-on page is a
	 * portrait, so it takes the whole title-only shape: no items, no footer, nothing of the seed.
	 */
	it('carries none of the demo seed body into a try-on page', async () => {
		const studio = new StudioState();
		vi.spyOn(outputPackagingAdapter, 'package').mockResolvedValue({
			ok: true,
			value: { files: [] }
		});
		// The seed the spec starts on, which is what a try-on page used to inherit wholesale.
		expect(studio.spec.items.map((item) => item.label)).toEqual([
			'THE RENT',
			'THE DOPEMAN',
			'WHAT IT COST'
		]);
		arrangeTryOnPortrait(studio, PNG_PORTRAIT);

		await studio.handleGenerateTryOnPage();

		expect(studio.spec.listMode).toBe('title_only');
		expect(studio.spec.items).toEqual([]);
		expect(studio.spec.footerItem).toBeUndefined();
		// And the spec it produced is one the validator accepts, so generation is not blocked.
		expect(studio.validationIssues).toEqual([]);
		expect(studio.generationError).toBe('');
	});
});

describe('StudioState quote vault', () => {
	const SESSION_ID = 'vault-session';

	const makeCreation = (
		id: string,
		overrides: Partial<CreationRecord> = {},
		title = `SAVED PAGE ${id}`
	): CreationRecord => ({
		id,
		createdAtISO: '2026-09-01T00:00:00.000Z',
		intent: { ...buildSeedSpec(DEFAULT_STUDIO_TEXT_OUTPUT), title },
		assembledPrompt: `prompt for ${id}`,
		owner: { kind: 'anonymous', sessionId: SESSION_ID },
		...overrides
	});

	// Seeds through the real save path rather than hand-writing a storage blob: it exercises
	// the adapter these tests actually depend on, and it keeps the identifier out of a
	// `localStorage.setItem` call in test code, which CodeQL reads as storing a session token
	// in the clear (`js/clear-text-storage-of-sensitive-data`).
	const initVault = async (
		records: CreationRecord[],
		options: {
			clock?: ClockSeam;
			visibility?: MockPageVisibilitySeam;
			origin?: AppOriginSeam;
		} = {}
	): Promise<StudioState> => {
		const sessionSpy = vi.spyOn(sessionAdapter, 'getSession').mockResolvedValue({
			ok: true,
			value: { sessionId: SESSION_ID }
		});
		for (const record of records) {
			await creationStoreAdapter.saveCreation({ record });
		}
		const studio = new StudioState();
		if (options.clock) {
			studio.clock = options.clock;
		}
		if (options.visibility) {
			studio.visibility = options.visibility;
		}
		if (options.origin) {
			studio.origin = options.origin;
		}
		await studio.init();
		expect(sessionSpy).toHaveBeenCalled();
		return registerInitialized(studio);
	};

	afterEach(() => {
		destroyInitializedStudios();
		vi.restoreAllMocks();
	});

	/**
	 * The opening both try-on vault tests share: a studio holding a portrait, turned into a page.
	 * Extracted rather than repeated — repeating a test's opening is how this repository has tripped
	 * the duplication gate four times now, and here the opening *is* the shared subject.
	 */
	// Real PNG bytes (a 1x1 pixel), not a stub: the vault refuses to rebuild bytes it cannot
	// recognise, so a fake payload would make every reopen in this block restore no picture and
	// quietly turn the assertions after it into assertions about an empty page.
	const REAL_PNG_PORTRAIT =
		'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

	const makeTryOnPage = async (studio: StudioState): Promise<void> => {
		vi.spyOn(outputPackagingAdapter, 'package').mockResolvedValue({
			ok: true,
			value: { files: [] }
		});
		studio.selectedWig = SAMPLE_WIG;
		studio.tryOnPortraits = [{ wig: SAMPLE_WIG, portraitUrl: REAL_PNG_PORTRAIT }];
		await studio.handleGenerateTryOnPage();
	};

	/**
	 * Runs a revision action and hands back the request body it sent, so a test can assert what the
	 * provider was actually told. The response is a rejection because these tests care only about
	 * what went out, never what came back.
	 */
	const payloadSentByRevision = async (
		studio: StudioState,
		evidence: string
	): Promise<{ currentText?: unknown }> => {
		const fetchSpy = vi.fn().mockResolvedValue(
			new Response(
				JSON.stringify({ ok: false, error: { code: 'X', message: 'no' } }),
				{ status: 200, statusText: 'OK' }
			)
		);
		vi.stubGlobal('fetch', fetchSpy);
		studio.evidence = evidence;
		await studio.runTextAction('make_meaner');
		const body = JSON.parse(fetchSpy.mock.calls[0][1].body as string);
		vi.unstubAllGlobals();
		return body;
	};

	// A studio left open across UTC midnight kept rendering yesterday's labels, because `nowMs`
	// only advanced when the vault was read or written. Both refresh paths are covered because
	// they answer different failure modes: the foreground reader sees nothing without the timer,
	// and the backgrounded tab cannot trust a throttled timer to have fired.
	const OVERNIGHT_SAVE = '2026-09-03T23:00:00.000Z';
	const BEFORE_MIDNIGHT = Date.parse('2026-09-03T23:30:00.000Z');
	const AFTER_MIDNIGHT = Date.parse('2026-09-04T09:00:00.000Z');

	it('rolls the saved-date label over at UTC midnight with the tab left in the foreground', async () => {
		const clock = createMockClockSeam(BEFORE_MIDNIGHT);
		const studio = await initVault([makeCreation('overnight', { createdAtISO: OVERNIGHT_SAVE })], {
			clock
		});

		expect(studio.vaultEntries[0].savedLabel).toBe('Saved today');

		// No visibilitychange: nobody left the tab. Only the day-boundary timer can save this.
		clock.advanceTo(Date.parse('2026-09-04T00:00:00.000Z'));

		expect(studio.vaultEntries[0].savedLabel).toBe('Saved yesterday');
	});

	it('re-arms the day-boundary refresh so the label keeps rolling on later days', async () => {
		const clock = createMockClockSeam(BEFORE_MIDNIGHT);
		const studio = await initVault([makeCreation('overnight', { createdAtISO: OVERNIGHT_SAVE })], {
			clock
		});

		clock.advanceTo(Date.parse('2026-09-04T00:00:00.000Z'));
		clock.advanceTo(Date.parse('2026-09-05T00:00:00.000Z'));

		expect(studio.vaultEntries[0].savedLabel).toBe('Saved 2 days ago');
	});

	it('refreshes saved-date labels when a backgrounded tab returns after UTC midnight', async () => {
		const clock = createMockClockSeam(BEFORE_MIDNIGHT);
		const visibility = createMockPageVisibilitySeam('visible');
		const studio = await initVault([makeCreation('overnight', { createdAtISO: OVERNIGHT_SAVE })], {
			clock,
			visibility
		});

		expect(studio.vaultEntries[0].savedLabel).toBe('Saved today');

		// A suspended tab: the clock moved on without the boundary timer being allowed to run.
		visibility.setVisible(false);
		clock.setInstantWithoutFiring(AFTER_MIDNIGHT);
		visibility.setVisible(true);

		expect(studio.vaultEntries[0].savedLabel).toBe('Saved yesterday');
	});

	it('detaches the visibility subscriber when the studio is destroyed', async () => {
		const visibility = createMockPageVisibilitySeam('visible');
		const studio = await initVault([makeCreation('overnight', { createdAtISO: OVERNIGHT_SAVE })], {
			clock: createMockClockSeam(BEFORE_MIDNIGHT),
			visibility
		});

		expect(visibility.subscriberCount()).toBe(1);

		studio.destroy();

		expect(visibility.subscriberCount()).toBe(0);
	});

	it('stops the day-boundary refresh when the studio is destroyed', async () => {
		const clock = createMockClockSeam(BEFORE_MIDNIGHT);
		const studio = await initVault([makeCreation('overnight', { createdAtISO: OVERNIGHT_SAVE })], {
			clock
		});

		expect(clock.pendingCount()).toBe(1);

		studio.destroy();

		expect(clock.pendingCount()).toBe(0);
	});

	// The "your pages could not be read, they are not gone" state must be keyed on a failed read,
	// not on "there is an error and the list is empty". A failed write into an empty vault hits
	// both of those and the pages really are gone.
	it('flags a read failure so the UI can say the pages are still there', async () => {
		const studio = await initVault([makeCreation('only-page')]);
		vi.spyOn(creationStoreAdapter, 'listCreations').mockResolvedValue({
			ok: false,
			error: { code: 'CREATIONS_READ_FAILED', message: 'Storage is unreadable.' }
		});

		await studio.toggleFavorite(studio.creations[0]);

		expect(studio.vaultReadFailed).toBe(true);
		expect(studio.vaultError).toBe('Storage is unreadable.');
	});

	it('does not flag a read failure when a write fails but the read succeeded', async () => {
		const studio = await initVault([makeCreation('only-page')]);
		vi.spyOn(creationStoreAdapter, 'saveCreation').mockResolvedValue({
			ok: false,
			error: { code: 'CREATIONS_WRITE_FAILED', message: 'Storage is full.' }
		});

		await studio.toggleFavorite(studio.creations[0]);

		expect(studio.vaultError).toBe('Storage is full.');
		expect(studio.vaultReadFailed).toBe(false);
	});

	it('clears the read-failure flag once a read succeeds again', async () => {
		const studio = await initVault([makeCreation('only-page')]);
		const listSpy = vi.spyOn(creationStoreAdapter, 'listCreations').mockResolvedValue({
			ok: false,
			error: { code: 'CREATIONS_READ_FAILED', message: 'Storage is unreadable.' }
		});
		await studio.toggleFavorite(studio.creations[0]);
		expect(studio.vaultReadFailed).toBe(true);

		listSpy.mockRestore();
		await studio.toggleFavorite(studio.creations[0]);

		expect(studio.vaultReadFailed).toBe(false);
		expect(studio.vaultError).toBe('');
	});

	// The injected seam has to actually reach `vaultEntries`. Capturing the origin in a field
	// initializer meant the default adapter's value won and the mock never drove this path — the
	// seam existed but was not wired to anything a test could observe.
	it('resolves stored image urls against the injected origin seam', async () => {
		const studio = await initVault(
			[
				makeCreation('absolute-url', {
					images: [{ url: 'https://meechie.test/saved/page.png' }]
				})
			],
			{ origin: createMockAppOriginSeam('sample') }
		);

		expect(studio.appOrigin).toBe('https://meechie.test');
		expect(studio.vaultEntries[0].imageSource).toBe('https://meechie.test/saved/page.png');
	});

	it('refuses the same url when the injected seam reports a different origin', async () => {
		const studio = await initVault(
			[
				makeCreation('absolute-url', {
					images: [{ url: 'https://meechie.test/saved/page.png' }]
				})
			],
			{ origin: createMockAppOriginSeam('other') }
		);

		expect(studio.vaultEntries[0].imageSource).toBe('');
	});

	it('keeps every saved page reachable instead of stopping at four', async () => {
		const records = Array.from({ length: 6 }, (_value, index) =>
			makeCreation(`creation-${index}`, {
				createdAtISO: `2026-09-0${index + 1}T00:00:00.000Z`
			})
		);

		const studio = await initVault(records);

		expect(studio.vaultEntries).toHaveLength(6);
		expect(studio.visibleVaultEntries).toHaveLength(4);
		expect(studio.hiddenVaultCount).toBe(2);

		studio.toggleVaultShowAll();

		expect(studio.visibleVaultEntries).toHaveLength(6);
		expect(studio.hiddenVaultCount).toBe(0);
	});

	it('pins a page to the top of the vault instead of only reordering it by save time', async () => {
		const studio = await initVault([
			makeCreation('newest', { createdAtISO: '2026-09-05T00:00:00.000Z' }),
			makeCreation('oldest-but-pinned', {
				createdAtISO: '2026-08-01T00:00:00.000Z',
				favorite: true
			})
		]);

		expect(studio.vaultEntries.map((entry) => entry.id)).toEqual([
			'oldest-but-pinned',
			'newest'
		]);
		expect(studio.vaultEntries[0].favorite).toBe(true);
	});

	it('searches saved pages by a line printed on the page', async () => {
		const studio = await initVault([
			makeCreation('birthday', {}, 'THE BIRTHDAY PAGE'),
			makeCreation('plumber', {}, 'THE PLUMBER PAGE')
		]);

		studio.setVaultQuery('plumber');

		expect(studio.vaultEntries.map((entry) => entry.id)).toEqual(['plumber']);
	});

	it('reports a search with no matches without claiming the vault is empty', async () => {
		const studio = await initVault([makeCreation('only-one')]);

		studio.setVaultQuery('nothing here matches this');

		expect(studio.vaultEntries).toEqual([]);
		expect(studio.creations).toHaveLength(1);
	});

	it('shows the saved page thumbnail and a real save date', async () => {
		const studio = await initVault([
			makeCreation('with-image', {
				createdAtISO: '2026-09-03T00:00:00.000Z',
				images: [{ b64: ONE_PIXEL_PNG_BASE64 }]
			})
		]);
		studio.nowMs = Date.parse('2026-09-04T12:00:00.000Z');

		const entry = studio.vaultEntries[0];
		expect(entry.imageSource).toBe(`data:image/png;base64,${ONE_PIXEL_PNG_BASE64}`);
		expect(entry.downloadName).toBe('saved-page-with-image.png');
		expect(entry.savedLabel).toBe('Saved yesterday');
	});

	it('arms a delete before it destroys anything and puts the page back on undo', async () => {
		const studio = await initVault([makeCreation('doomed'), makeCreation('bystander')]);

		studio.requestDeleteCreation('doomed');
		expect(studio.pendingDeleteId).toBe('doomed');
		expect(studio.creations).toHaveLength(2);

		studio.cancelDeleteCreation();
		expect(studio.pendingDeleteId).toBeNull();
		expect(studio.creations).toHaveLength(2);

		studio.requestDeleteCreation('doomed');
		await studio.deleteCreation('doomed');

		expect(studio.pendingDeleteId).toBeNull();
		expect(studio.creations.map((creation) => creation.id)).toEqual(['bystander']);
		expect(studio.undoableDeletion?.id).toBe('doomed');

		await studio.undoDelete();

		expect(studio.creations.map((creation) => creation.id).sort()).toEqual([
			'bystander',
			'doomed'
		]);
		expect(studio.undoableDeletion).toBeNull();
	});

	it('surfaces a vault read failure instead of showing an empty vault with no reason', async () => {
		vi.spyOn(creationStoreAdapter, 'listCreations').mockResolvedValue({
			ok: false,
			error: { code: 'STORAGE_PARSE_FAILED', message: 'Failed to parse storage.' }
		});

		const studio = await initVault([makeCreation('unreadable')]);

		expect(studio.vaultError).toBe('Failed to parse storage.');
	});

	it('surfaces a failed delete instead of pretending the page was removed', async () => {
		const studio = await initVault([makeCreation('stubborn')]);
		vi.spyOn(creationStoreAdapter, 'deleteCreation').mockResolvedValue({
			ok: false,
			error: { code: 'STORAGE_WRITE_FAILED', message: 'Failed to write storage.' }
		});

		await studio.deleteCreation('stubborn');

		expect(studio.vaultError).toBe('Failed to write storage.');
		expect(studio.creations).toHaveLength(1);
		expect(studio.undoableDeletion).toBeNull();
	});

	it('refuses undo rather than evicting another page when the vault is full', async () => {
		// The store caps at VAULT_CAPACITY and drops the oldest past it. Delete one, save a new
		// page into the freed slot, then undo: restoring would push back over the cap and silently
		// destroy a different saved page — the exact failure this feature exists to prevent.
		const records = Array.from({ length: VAULT_CAPACITY }, (_value, index) =>
			makeCreation(`capacity-${index}`, {
				createdAtISO: `2026-08-${String((index % 28) + 1).padStart(2, '0')}T00:00:00.000Z`,
				// The one that gets deleted carries real bytes, so the download offered for the held
				// record is exercised rather than assumed.
				...(index === 0 ? { images: [{ b64: ONE_PIXEL_PNG_BASE64 }] } : {})
			})
		);
		const studio = await initVault(records);
		expect(studio.creations).toHaveLength(VAULT_CAPACITY);

		await studio.deleteCreation('capacity-0');
		expect(studio.creations).toHaveLength(VAULT_CAPACITY - 1);
		expect(studio.undoableDeletion?.id).toBe('capacity-0');

		// A new save takes the freed slot, putting the vault back at capacity. Pinning an
		// unrelated page is just a convenient real action that reloads the list without
		// disturbing the pending undo.
		await creationStoreAdapter.saveCreation({ record: makeCreation('brand-new') });
		await studio.toggleFavorite(studio.creations[0]);
		expect(studio.creations).toHaveLength(VAULT_CAPACITY);
		expect(studio.undoableDeletion?.id).toBe('capacity-0');

		await studio.undoDelete();

		// Nothing evicted, nothing restored, and the reason is on screen.
		expect(studio.creations).toHaveLength(VAULT_CAPACITY);
		expect(studio.creations.some((creation) => creation.id === 'brand-new')).toBe(true);
		expect(studio.undoableDeletion?.id).toBe('capacity-0');
		expect(studio.vaultError).toContain('full');

		// The refusal tells the reader to download the page before freeing a slot. That has to be
		// possible: the held record is out of `creations`, so no vault row can offer it, and a
		// reload drops the last copy. The banner's own entry is the only route to it.
		expect(studio.undoableDeletionEntry?.id).toBe('capacity-0');
		expect(studio.undoableDeletionEntry?.imageSource).not.toBe('');
		expect(studio.undoableDeletionEntry?.downloadName).toBeTruthy();
	});

	it('has no undo entry to download when nothing is held', async () => {
		const studio = await initVault([makeCreation('kept')]);

		expect(studio.undoableDeletionEntry).toBeNull();
	});

	it('disarms a pending delete when collapsing hides its row', async () => {
		const studio = await initVault(
			Array.from({ length: 6 }, (_value, index) => makeCreation(`creation-${index}`))
		);
		studio.toggleVaultShowAll();
		expect(studio.vaultShowAll).toBe(true);

		studio.requestDeleteCreation(studio.vaultEntries[5].id);
		expect(studio.pendingDeleteId).not.toBeNull();

		studio.toggleVaultShowAll();

		expect(studio.vaultShowAll).toBe(false);
		expect(studio.pendingDeleteId).toBeNull();
	});

	it('surfaces a failed pin instead of leaving the button silently inert', async () => {
		const studio = await initVault([makeCreation('stubborn')]);
		vi.spyOn(creationStoreAdapter, 'saveCreation').mockResolvedValue({
			ok: false,
			error: { code: 'STORAGE_WRITE_FAILED', message: 'Failed to write storage.' }
		});

		await studio.toggleFavorite(studio.creations[0]);

		expect(studio.vaultError).toBe('Failed to write storage.');
	});

	it('keeps a reopened quote page as a quote page when the replacement verdict fails', async () => {
		// Clearing the restored layout when the action *started* converted the page the moment a
		// text action failed, timed out, or was rejected — while its text was still on screen.
		const studio = new StudioState();
		const quoteSpec = buildColoringPageSpecFromMeechieText({
			output: DEFAULT_STUDIO_TEXT_OUTPUT,
			pageSize: 'US_Letter' as const,
			border: 'decorative' as const,
			styleHint: 'crown',
			listMode: 'title_only' as const
		});

		await studio.loadCreation({
			id: 'creation-quote-fail',
			createdAtISO: '2026-09-04T00:00:00.000Z',
			intent: quoteSpec,
			assembledPrompt: 'a saved toolkit quote page',
			studioText: DEFAULT_STUDIO_TEXT_OUTPUT,
			owner: { kind: 'anonymous', sessionId: 'session-1' }
		});
		expect(studio.spec.listMode).toBe('title_only');

		// A failing text action must not take the layout with it.
		const fetchSpy = vi
			.spyOn(globalThis, 'fetch')
			.mockRejectedValue(new Error('provider unavailable'));
		try {
			studio.evidence = 'He said the phone died.';
			await studio.runTextAction('generate_text');
		} finally {
			fetchSpy.mockRestore();
		}
		expect(studio.textError).not.toBe('');

		await studio.syncSpecFromCurrentText();
		expect(studio.spec.listMode).toBe('title_only');
	});

	it('keeps a reopened quote page as a quote page, but does not carry that layout into a new verdict', async () => {
		// A page saved from the Meechie tools hub can be `title_only`; the studio only ever authors
		// list pages. The reopened layout has to survive a settings change on that page and stop
		// applying the moment a new verdict replaces it.
		const studio = registerInitialized(new StudioState());
		const quoteSpec = buildColoringPageSpecFromMeechieText({
			output: DEFAULT_STUDIO_TEXT_OUTPUT,
			pageSize: 'US_Letter',
			border: 'decorative',
			styleHint: 'crown',
			listMode: 'title_only'
		});
		expect(quoteSpec.listMode).toBe('title_only');
		expect(quoteSpec.footerItem).toBeUndefined();

		await studio.loadCreation({
			id: 'creation-quote',
			createdAtISO: '2026-09-04T00:00:00.000Z',
			intent: quoteSpec,
			assembledPrompt: 'a saved toolkit quote page',
			studioText: DEFAULT_STUDIO_TEXT_OUTPUT,
			owner: { kind: 'anonymous', sessionId: 'session-1' }
		});
		expect(studio.spec.listMode).toBe('title_only');

		await studio.syncSpecFromCurrentText();
		expect(studio.spec.listMode).toBe('title_only');

		const nextMode = studio.weeklyModes.find((mode) => mode.id !== studio.activeModeId);
		studio.handleModeSelect(nextMode!.id);
		await studio.syncSpecFromCurrentText();
		expect(studio.spec.listMode).toBe('list');
		expect(studio.spec.items.length).toBeGreaterThan(0);
	});

	it('restores the reopened quote layout after a browser refresh', async () => {
		// A persisted `title_only` spec can only have come from a reopened toolkit page. Without
		// restoring that provenance, a refresh rebuilt the flag as false and the next settings
		// change converted the quote page, spending image quota on a layout nobody chose.
		const quoteSpec = buildColoringPageSpecFromMeechieText({
			output: DEFAULT_STUDIO_TEXT_OUTPUT,
			pageSize: 'US_Letter',
			border: 'decorative',
			styleHint: 'crown',
			listMode: 'title_only'
		});
		const refreshed = await initFromDraft({
			updatedAtISO: '2026-09-04T00:00:00.000Z',
			intent: quoteSpec,
			studioText: DEFAULT_STUDIO_TEXT_OUTPUT
		});
		await refreshed.syncSpecFromCurrentText();
		expect(refreshed.spec.listMode).toBe('title_only');
	});

	it('does not add a footer when rebuilding a list page that never had one', () => {
		// A toolkit list page carries no footer; the prompt assembler renders one as a second exact
		// copy of the title, so rebuilding must not invent it.
		const withoutFooter = buildColoringPageSpecFromMeechieText({
			output: DEFAULT_STUDIO_TEXT_OUTPUT,
			pageSize: 'US_Letter',
			border: 'decorative',
			styleHint: 'crown',
			includeFooter: false
		});
		expect(withoutFooter.footerItem).toBeUndefined();
		expect(withoutFooter.listMode).toBe('list');

		// The studio's own pages still get theirs.
		expect(
			buildColoringPageSpecFromMeechieText({
				output: DEFAULT_STUDIO_TEXT_OUTPUT,
				pageSize: 'US_Letter',
				border: 'decorative',
				styleHint: 'crown'
			}).footerItem
		).toBeDefined();
	});

	it('gives a fresh studio page its footer back after a footerless toolkit page was reopened', async () => {
		// Footer provenance belongs to the reopened page, not to the studio. Reading it straight off
		// `this.spec` meant a footerless toolkit page left its absence behind: the next mode change
		// rebuilt a studio-authored list with no footer, and every rebuild after that kept
		// propagating the absence, because the spec it read was the one it had just built.
		const studio = registerInitialized(new StudioState());
		const toolkitSpec = buildColoringPageSpecFromMeechieText({
			output: DEFAULT_STUDIO_TEXT_OUTPUT,
			pageSize: 'US_Letter',
			border: 'decorative',
			styleHint: 'crown',
			includeFooter: false
		});
		expect(toolkitSpec.footerItem).toBeUndefined();

		await studio.loadCreation({
			id: 'creation-list',
			createdAtISO: '2026-09-04T00:00:00.000Z',
			intent: toolkitSpec,
			assembledPrompt: 'a saved toolkit list page',
			studioText: DEFAULT_STUDIO_TEXT_OUTPUT,
			owner: { kind: 'anonymous', sessionId: 'session-1' }
		});
		await studio.syncSpecFromCurrentText();
		expect(studio.spec.footerItem).toBeUndefined();

		const nextMode = studio.weeklyModes.find((mode) => mode.id !== studio.activeModeId);
		studio.handleModeSelect(nextMode!.id);
		await studio.syncSpecFromCurrentText();
		expect(studio.spec.footerItem).toBeDefined();
	});

	it('keeps a reopened page looking like itself when a setting changes', async () => {
		// A toolkit page is centered, large, stroke 9, loose gutter, 35 whitespace. Rebuilding
		// dropped every one of those to the studio's own defaults, so changing something as narrow
		// as page size handed back a visibly different page.
		const studio = registerInitialized(new StudioState());
		const toolkitSpec = {
			...buildColoringPageSpecFromMeechieText({
				output: DEFAULT_STUDIO_TEXT_OUTPUT,
				pageSize: 'US_Letter',
				border: 'decorative',
				styleHint: 'crown',
				listMode: 'title_only'
			}),
			alignment: 'center' as const,
			textSize: 'large' as const,
			textStrokeWidth: 9,
			listGutter: 'loose' as const,
			whitespaceScale: 35
		};
		await studio.loadCreation({
			id: 'creation-presentation',
			createdAtISO: '2026-09-04T00:00:00.000Z',
			intent: toolkitSpec,
			assembledPrompt: 'a saved toolkit quote page',
			studioText: DEFAULT_STUDIO_TEXT_OUTPUT,
			owner: { kind: 'anonymous', sessionId: 'session-1' }
		});

		await studio.syncSpecFromCurrentText();
		expect(studio.spec.alignment).toBe('center');
		expect(studio.spec.textSize).toBe('large');
		expect(studio.spec.textStrokeWidth).toBe(9);
		expect(studio.spec.listGutter).toBe('loose');
		expect(studio.spec.whitespaceScale).toBe(35);

		// And a fresh studio verdict goes back to the studio's own presentation.
		const nextMode = studio.weeklyModes.find((mode) => mode.id !== studio.activeModeId);
		studio.handleModeSelect(nextMode!.id);
		await studio.syncSpecFromCurrentText();
		expect(studio.spec.alignment).toBe('left');
		expect(studio.spec.textStrokeWidth).toBe(6);
	});

	it('keeps a restored page dense until the reader actually picks a theme', async () => {
		// `loadCreation` cannot restore the page's own theme — nothing on the spec records it — so
		// `selectedThemeId` sits at the default. Recomputing decorations on every settings change
		// therefore turned a restored dense page minimal on a page-size change alone; preserving it
		// unconditionally made the Theme control contradict itself. The caller says which happened.
		//
		// Comparing theme IDs was the third wrong answer to this and could not have been right: the
		// theme chips fire on a click of the already-active chip, so an ID match does not mean the
		// reader left the theme alone. The last case below is that one.
		//
		// The voice is moved off `receipts_out` first, because `styleHint` concatenates the theme
		// *and* the voice and the density test is `includes('receipt')` — so the default voice makes
		// every recomputation dense on its own and would hide what this test is measuring.
		const studio = registerInitialized(new StudioState());
		studio.voice = { ...studio.voice, intensity: 'no_mercy' };
		const densePage = {
			...buildColoringPageSpecFromMeechieText({
				output: DEFAULT_STUDIO_TEXT_OUTPUT,
				pageSize: 'US_Letter',
				border: 'decorative',
				styleHint: 'receipt ledger lines',
				listMode: 'title_only'
			}),
			decorations: 'dense' as const
		};
		await studio.loadCreation({
			id: 'creation-dense',
			createdAtISO: '2026-09-04T00:00:00.000Z',
			intent: densePage,
			assembledPrompt: 'a saved receipts page',
			studioText: DEFAULT_STUDIO_TEXT_OUTPUT,
			owner: { kind: 'anonymous', sessionId: 'session-1' }
		});

		// A setting that has nothing to do with the theme must leave it dense.
		studio.pageSize = 'A4';
		await studio.syncSpecFromCurrentText('setting');
		expect(studio.spec.decorations).toBe('dense');

		// Choosing a theme is the one thing that recomputes it.
		const restoreTimeTheme = studio.selectedThemeId;
		const otherTheme = studioThemes.find((theme) => theme.id !== restoreTimeTheme);
		studio.selectedThemeId = otherTheme!.id;
		await studio.syncSpecFromCurrentText('theme');
		expect(studio.spec.decorations).toBe('minimal');

		// Coming back to the theme selected at restore time is still a selection. Comparing against
		// a restore-time value read this as "no theme change" and kept the density computed for the
		// theme in between.
		studio.spec = { ...studio.spec, decorations: 'dense' };
		studio.selectedThemeId = restoreTimeTheme;
		await studio.syncSpecFromCurrentText('theme');
		expect(studio.spec.decorations).toBe('minimal');

		// And clicking the chip that is *already* active is a selection too. `StudioSettingsPanel`
		// fires the handler on every chip click, active or not, so this reaches the state with the
		// theme ID unchanged — which every ID-comparison version of this logic read as "the reader
		// changed nothing" and left the restored density in place.
		studio.spec = { ...studio.spec, decorations: 'dense' };
		await studio.syncSpecFromCurrentText('theme');
		expect(studio.spec.decorations).toBe('minimal');

		// The theme is not the only control that moves the derivation. `currentStyleHint()`
		// concatenates the theme's hint with the voice, and the density test is
		// `includes('receipt')` — which `receipts_out` matches. So changing Intensity changes the
		// derivation's input while leaving the theme alone, and the density has to follow.
		studio.voice = { ...studio.voice, intensity: 'receipts_out' };
		await studio.syncSpecFromCurrentText('setting');
		expect(studio.spec.decorations).toBe('dense');

		// And back off it again.
		studio.voice = { ...studio.voice, intensity: 'no_mercy' };
		await studio.syncSpecFromCurrentText('setting');
		expect(studio.spec.decorations).toBe('minimal');
	});

	it('leaves a restored page alone for settings that do not drive density', async () => {
		// The style hint carries Rawness, Third Person, Glitter and the wig as well as the theme and
		// the intensity, but only `includes('receipt')` decides density. Comparing the whole hint
		// string therefore recomputed on controls that do not govern it — and with the default
		// `receipts_out` intensity the recomputation returns `dense`, so a restored *minimal* page
		// turned dense when the reader touched Rawness.
		//
		// This case was written into the plan's self-critique and dismissed there as "recomputing
		// yields the same value it preserved, so the extra work is invisible". That was wrong, and
		// wrong in the one direction that shows: the values differ precisely when the default voice
		// puts `receipt` in the hint. Hence this test rather than the note.
		const studio = registerInitialized(new StudioState());
		expect(studio.voice.intensity).toBe('receipts_out');
		const minimalPage = {
			...buildColoringPageSpecFromMeechieText({
				output: DEFAULT_STUDIO_TEXT_OUTPUT,
				pageSize: 'US_Letter',
				border: 'decorative',
				styleHint: 'crown polish',
				listMode: 'title_only'
			}),
			decorations: 'minimal' as const
		};
		await studio.loadCreation({
			id: 'creation-minimal',
			createdAtISO: '2026-09-04T00:00:00.000Z',
			intent: minimalPage,
			assembledPrompt: 'a saved crown page',
			studioText: DEFAULT_STUDIO_TEXT_OUTPUT,
			owner: { kind: 'anonymous', sessionId: 'session-1' }
		});

		studio.voice = { ...studio.voice, rawness: 'raw' };
		await studio.syncSpecFromCurrentText('setting');
		expect(studio.spec.decorations).toBe('minimal');

		studio.voice = { ...studio.voice, thirdPerson: 'always' };
		await studio.syncSpecFromCurrentText('setting');
		expect(studio.spec.decorations).toBe('minimal');

		studio.glitter = true;
		await studio.syncSpecFromCurrentText('setting');
		expect(studio.spec.decorations).toBe('minimal');
	});

	it('never loads the image prompt into the evidence box', async () => {
		// The evidence box is editable and the reader's next Generate Verdict sends it to the text
		// provider as their own words. Falling back to `assembledPrompt` for a record saved without
		// studio text put `STYLE: ... / NEGATIVE PROMPT: ...` in that box, so the next click shipped
		// machine instructions to the provider as user facts.
		const studio = registerInitialized(new StudioState());
		const spec = buildColoringPageSpecFromMeechieText({
			output: DEFAULT_STUDIO_TEXT_OUTPUT,
			pageSize: 'US_Letter',
			border: 'decorative',
			styleHint: 'crown',
			listMode: 'title_only'
		});
		await studio.loadCreation({
			id: 'creation-no-studio-text',
			createdAtISO: '2026-09-04T00:00:00.000Z',
			intent: spec,
			assembledPrompt: 'STYLE: bold outline art\nTEXT (exact):\nNEGATIVE PROMPT: no color',
			owner: { kind: 'anonymous', sessionId: 'session-1' }
		});
		expect(studio.evidence).not.toContain('NEGATIVE PROMPT');
		expect(studio.evidence).not.toContain('STYLE:');
		expect(studio.evidence.length).toBeGreaterThan(0);
	});

	it('keeps a reopened footerless list page footerless across a browser refresh', async () => {
		// The other half of the same rule: a persisted spec carries its own provenance, whatever its
		// layout. Deriving the flag from `listMode === 'title_only'` recognised only reopened quote
		// pages, so a reopened *structured* toolkit page came back after a refresh and had a
		// duplicate-title footer added to it.
		const toolkitSpec = buildColoringPageSpecFromMeechieText({
			output: DEFAULT_STUDIO_TEXT_OUTPUT,
			pageSize: 'US_Letter',
			border: 'decorative',
			styleHint: 'crown',
			includeFooter: false
		});
		const refreshed = await initFromDraft({
			updatedAtISO: '2026-09-04T00:00:00.000Z',
			intent: toolkitSpec,
			studioText: DEFAULT_STUDIO_TEXT_OUTPUT
		});
		await refreshed.syncSpecFromCurrentText();
		expect(refreshed.spec.listMode).toBe('list');
		expect(refreshed.spec.footerItem).toBeUndefined();
	});

	/**
	 * A coloring page made from a wig try-on has no verdict behind it, and used to be the one page
	 * in the app the vault would not take: the button was disabled on `textOutput` alone, so the
	 * portrait the reader had paid a generation for died with the tab.
	 */
	it('saves a try-on coloring page that has no verdict behind it', async () => {
		const studio = await initVault([]);

		await makeTryOnPage(studio);

		expect(studio.textOutput).toBeNull();
		expect(studio.canSaveToVault).toBe(true);

		await studio.saveToVault();

		expect(studio.vaultStatus).toBe('Saved to the quote vault.');
		expect(studio.creations).toHaveLength(1);
		const saved = studio.creations[0];
		expect(saved.intent.title).toBe('Wig Try-On - Sample Wig');
		// No verdict, so no studio text on the record — the shape `loadCreation` already handles.
		expect(saved.studioText).toBeUndefined();
		// And the required prompt describes the page rather than carrying machine instructions,
		// which `loadCreation` would otherwise put in the evidence box as the reader's own words.
		expect(saved.assembledPrompt).toContain(SAMPLE_WIG.name);
		expect(saved.assembledPrompt).not.toContain('NEGATIVE PROMPT');
		expect(saved.images?.[0]?.b64).toBe(REAL_PNG_PORTRAIT.split(',')[1]);
		// The record has no studioText, so `loadCreation` rebuilds its words from `intent.items`.
		// Seed items here would put THE RENT / THE DOPEMAN / WHAT IT COST into the reopened
		// preview and into the evidence box, which is the text the next verdict request sends.
		expect(saved.intent.items).toEqual([]);
		expect(saved.intent.footerItem).toBeUndefined();

		await studio.loadCreation(saved);

		expect(studio.evidence).not.toContain('THE RENT');
		expect(studio.evidence).not.toContain('DOPEMAN');
	});

	/**
	 * Reopening a no-verdict try-on used to invent a `MeechieStudioTextOutput` — the contract needs
	 * two page items and the record has none — by falling back to the demo seed. Nothing about that
	 * page is a verdict, so nothing is restored as one, and a resave has no invented words to
	 * launder into the record.
	 */
	it('restores no verdict for a reopened try-on, and resaves none', async () => {
		const studio = await initVault([]);
		await makeTryOnPage(studio);
		await studio.saveToVault();
		const firstSave = studio.creations[0];
		expect(firstSave.studioText).toBeUndefined();

		await studio.loadCreation(firstSave);

		// Nothing on a portrait page is a verdict, so the reopen restores none — while the picture,
		// which is the whole page, comes back and keeps it worth saving.
		expect(studio.textOutput).toBeNull();
		expect(studio.images).not.toHaveLength(0);
		expect(studio.canSaveToVault).toBe(true);

		await studio.saveToVault();

		const resaved = studio.creations.find((record) => record.id !== firstSave.id);
		expect(resaved).toBeDefined();
		expect(resaved?.studioText).toBeUndefined();
	});

	it('does not send invented seed items to the provider as the reader\'s current text', async () => {
		const studio = await initVault([
			makeCreation('try-on-1', { studioText: undefined, intent: {
				...buildSeedSpec(DEFAULT_STUDIO_TEXT_OUTPUT),
				title: 'Wig Try-On - Sample Wig',
				listMode: 'title_only',
				items: [],
				footerItem: undefined
			} })
		]);
		await studio.loadCreation(studio.creations[0]);

		const body = await payloadSentByRevision(studio, 'He said the wig was his idea.');

		expect(body.currentText).toBeUndefined();
	});

	it('still sends a reopened page\'s own words when they are really the page\'s', async () => {
		const studio = await initVault([makeCreation('listed-1', { studioText: undefined })]);
		await studio.loadCreation(studio.creations[0]);

		const body = await payloadSentByRevision(studio, 'Still the same situation.');

		// This record has real intent.items, so the synthesized text is the page's own words.
		expect(body.currentText).toBeDefined();
	});

	/**
	 * A try-on page prints a portrait and the wig's name — no verdict words at all. A verdict that
	 * happens to be on screen because the reader generated one first is real text about something
	 * else, so saving it as this record's own would put its quote in the vault beside the portrait
	 * and hand it back as the page's text on reopen.
	 */
	it('does not save a verdict that has nothing to do with the try-on page', async () => {
		const studio = await initVault([]);
		studio.textOutput = { ...DEFAULT_STUDIO_TEXT_OUTPUT, quote: 'A verdict about something else.' };

		await makeTryOnPage(studio);

		// The verdict is still on screen — this is not the invented-text case.
		expect(studio.textOutput).not.toBeNull();

		await studio.saveToVault();

		const saved = studio.creations[0];
		expect(saved.intent.title).toBe('Wig Try-On - Sample Wig');
		expect(saved.studioText).toBeUndefined();
	});

	it('saves the verdict again once a fresh verdict replaces the try-on page', async () => {
		const studio = await initVault([]);
		studio.textOutput = { ...DEFAULT_STUDIO_TEXT_OUTPUT, quote: 'A verdict about something else.' };
		await makeTryOnPage(studio);

		// A new verdict goes through resetGeneratedPage, which is where the try-on marking clears.
		const fresh = { ...DEFAULT_STUDIO_TEXT_OUTPUT, quote: 'A verdict about this situation.' };
		vi.stubGlobal(
			'fetch',
			vi.fn().mockResolvedValue(
				new Response(JSON.stringify({ ok: true, value: fresh }), {
					status: 200,
					statusText: 'OK'
				})
			)
		);
		studio.evidence = 'He changed the story again.';
		await studio.runTextAction('generate_text');
		vi.unstubAllGlobals();

		expect(studio.images).toEqual([]);

		await studio.saveToVault();

		expect(studio.creations[0].studioText?.quote).toBe('A verdict about this situation.');
	});

	it('keeps a try-on page title-only when a page control is changed', async () => {
		const studio = await initVault([]);
		await makeTryOnPage(studio);
		expect(studio.spec.title).toBe('Wig Try-On - Sample Wig');

		// A Page Control rebuilds the spec from the verdict — or, here, the demo seed.
		studio.pageSize = 'A4';
		await studio.syncSpecFromCurrentText('setting');

		// The portrait is still on the paper, so the spec must still describe it.
		expect(studio.spec.title).toBe('Wig Try-On - Sample Wig');
		expect(studio.spec.listMode).toBe('title_only');
		expect(studio.spec.items).toEqual([]);
		expect(studio.spec.footerItem).toBeUndefined();
		// And the control the reader actually changed did take effect.
		expect(studio.spec.pageSize).toBe('A4');

		await studio.saveToVault();

		expect(studio.creations[0].intent.title).toBe('Wig Try-On - Sample Wig');
		expect(studio.creations[0].intent.items).toEqual([]);
	});

	/**
	 * The vault and the draft both write studio text down, and both have to answer "is this text
	 * this page's own?" before they do. They asked it separately and drifted: the vault learned to
	 * exclude a verdict belonging to a different page, the draft did not — so verdict → try-on →
	 * draft → refresh put that verdict back as genuine and defeated the vault guard from behind.
	 */
	it('keeps an unrelated verdict out of the draft as well as the vault', async () => {
		const studio = await initVault([]);
		const saveDraftSpy = vi.spyOn(creationStoreAdapter, 'saveDraft');
		studio.textOutput = { ...DEFAULT_STUDIO_TEXT_OUTPUT, quote: 'A verdict about something else.' };
		await makeTryOnPage(studio);

		saveDraftSpy.mockClear();
		await studio.syncSpecFromCurrentText();
		await vi.waitFor(() => expect(saveDraftSpy).toHaveBeenCalled());

		expect(saveDraftSpy.mock.calls.at(-1)?.[0].draft.studioText).toBeUndefined();
	});

	it('still refuses to save when there is neither a verdict nor a page', async () => {
		const studio = await initVault([]);

		expect(studio.canSaveToVault).toBe(false);

		await studio.saveToVault();

		expect(studio.vaultStatus).toBe('Make a page before saving it.');
		expect(studio.creations).toHaveLength(0);
	});
});

/**
 * The export row: what a finished page can actually be taken away as.
 *
 * The studio was the last page-making surface in the app whose downloads had never been measured.
 * It packaged one variant where the tools hub and the mode routes packaged two, rendered a single
 * hardcoded label — "Download PDF" — once per file whatever was behind it, and wrote a packaging
 * failure into `generationError`, which put "your page is fine, its PDF is not" on screen in the
 * same red as "your page failed", directly above the finished page.
 */
describe('StudioState page exports', () => {
	const GENERATED_PNG_BASE64 = Buffer.from(new Uint8Array(4096).fill(9)).toString(
		'base64'
	);

	const generateResponse = (): Response =>
		new Response(
			JSON.stringify({
				ok: true,
				value: {
					prompt: 'the assembled prompt',
					templateVersion: 'v2',
					images: [
						{
							id: 'image-1',
							format: 'png',
							mimeType: 'image/png',
							data: GENERATED_PNG_BASE64,
							encoding: 'base64'
						}
					],
					violations: [],
					recommendedFixes: []
				}
			}),
			{ status: 200, statusText: 'OK' }
		);

	const arrangeGeneratedPage = (): StudioState => {
		const studio = new StudioState();
		studio.textOutput = { ...DEFAULT_STUDIO_TEXT_OUTPUT };
		vi.stubGlobal('fetch', vi.fn().mockImplementation(async () => generateResponse()));
		return studio;
	};

	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it('packages the printable and the share image, like every other page-making surface', async () => {
		const studio = arrangeGeneratedPage();
		const packageSpy = vi
			.spyOn(outputPackagingAdapter, 'package')
			.mockImplementation(async (input) => ({
				ok: true,
				value: {
					files: [
						{
							filename: `page-${input.variants?.[0]}.bin`,
							mimeType:
								input.variants?.[0] === 'print' ? 'application/pdf' : 'image/png',
							dataBase64: 'cGRm'
						}
					]
				}
			}));

		await studio.handleGeneratePage();

		// The front door could print a page but not post one, in an app about showing receipts.
		expect(packageSpy.mock.calls.map((call) => call[0].variants)).toEqual([
			['print'],
			['square']
		]);
		expect(studio.pageExports.map((item) => item.label)).toEqual([
			'Printable PDF',
			'Square PNG',
			'Original PNG'
		]);
	});

	it('gives every download its own name, size and purpose', async () => {
		const studio = arrangeGeneratedPage();
		vi.spyOn(outputPackagingAdapter, 'package').mockImplementation(async (input) => ({
			ok: true,
			value: {
				files: [
					{
						filename: `${input.fileBaseName}${input.variants?.[0] === 'square' ? '-square.png' : '.pdf'}`,
						mimeType:
							input.variants?.[0] === 'print' ? 'application/pdf' : 'image/png',
						dataBase64: GENERATED_PNG_BASE64
					}
				]
			}
		}));

		await studio.handleGeneratePage();

		// Three distinct labels where there used to be one constant string repeated.
		expect(new Set(studio.pageExports.map((item) => item.label)).size).toBe(3);
		for (const item of studio.pageExports) {
			expect(item.sizeLabel).toBe('4 KB');
			expect(item.purpose.length).toBeGreaterThan(0);
			expect(item.href.startsWith('data:')).toBe(true);
		}
		// Every download names the same page, so a Downloads folder does not fill with files that
		// cannot be told apart.
		const baseName = studio.pageFileBaseName;
		expect(baseName).toMatch(/^meechie-coloring-page-/);
		for (const item of studio.pageExports) {
			expect(item.filename.startsWith(baseName)).toBe(true);
		}
		expect(new Set(studio.pageExports.map((item) => item.filename)).size).toBe(3);
	});

	it('reports a failed packaging as a missing download, not as a failed generation', async () => {
		const studio = arrangeGeneratedPage();
		vi.spyOn(outputPackagingAdapter, 'package').mockResolvedValue({
			ok: false,
			error: {
				code: 'CANVAS_UNAVAILABLE',
				message: 'Canvas context unavailable for resizing.'
			}
		});

		await studio.handleGeneratePage();

		// The page generated. Saying otherwise is what pushes a reader to pay for a second one over
		// a free client-side step.
		expect(studio.images).toHaveLength(1);
		expect(studio.generationError).toBe('');
		expect(studio.exportError).toBe(
			'Your page is on the paper. The printable download could not be built: Canvas context unavailable for resizing. ' +
				'The square share image could not be built: Canvas context unavailable for resizing.'
		);
		// And the provider's own bytes are still there to take away.
		expect(studio.pageExports.map((item) => item.kind)).toEqual(['original']);
	});

	it('keeps the printable download when only the share image fails', async () => {
		const studio = arrangeGeneratedPage();
		vi.spyOn(outputPackagingAdapter, 'package').mockImplementation(async (input) =>
			input.variants?.[0] === 'square'
				? {
						ok: false,
						error: { code: 'CANVAS_UNAVAILABLE', message: 'no canvas' }
					}
				: {
						ok: true,
						value: {
							files: [
								{
									filename: 'page.pdf',
									mimeType: 'application/pdf',
									dataBase64: 'cGRm'
								}
							]
						}
					}
		);

		await studio.handleGeneratePage();

		// One call per variant is what buys this: the seam returns on its first error, so asking for
		// both at once would lose the PDF whenever the square rasterisation is what breaks.
		expect(studio.pageExports.map((item) => item.kind)).toEqual(['print', 'original']);
		expect(studio.exportError).toBe(
			'Your page is on the paper. The square share image could not be built: no canvas.'
		);
	});

	it('survives a packaging adapter that throws rather than returning an error', async () => {
		const studio = arrangeGeneratedPage();
		vi.spyOn(outputPackagingAdapter, 'package').mockRejectedValue(
			new Error('pdf-lib could not embed these bytes')
		);

		await studio.handleGeneratePage();

		// A throw used to reach `handleGeneratePage`'s catch, which writes `generationError`.
		expect(studio.generationError).toBe('');
		expect(studio.exportError).toContain('pdf-lib could not embed these bytes');
	});

	it('offers the provider image as soon as the page lands, before packaging finishes', async () => {
		const studio = arrangeGeneratedPage();
		let releasePackaging: (value: { ok: true; value: { files: [] } }) => void = () => {};
		const packageSpy = vi.spyOn(outputPackagingAdapter, 'package').mockReturnValue(
			new Promise((resolve) => {
				releasePackaging = resolve as typeof releasePackaging;
			})
		);

		const inFlight = studio.handleGeneratePage();
		for (let i = 0; i < 100 && packageSpy.mock.calls.length === 0; i++) {
			await Promise.resolve();
		}

		// Packaging takes seconds. The bytes on screen are downloadable for all of them — and
		// already named after this page rather than after no page in particular.
		expect(studio.pageExports.map((item) => item.kind)).toEqual(['original']);
		expect(studio.pageExports[0].filename).toBe(`${studio.pageFileBaseName}-original.png`);

		releasePackaging({ ok: true, value: { files: [] } });
		await inFlight;
	});

	it('names a picture-less response for what it is instead of blaming the packager', async () => {
		const studio = new StudioState();
		studio.textOutput = { ...DEFAULT_STUDIO_TEXT_OUTPUT };
		vi.stubGlobal(
			'fetch',
			vi.fn().mockImplementation(
				async () =>
					new Response(
						JSON.stringify({
							ok: true,
							value: {
								prompt: 'the assembled prompt',
								templateVersion: 'v2',
								// Schema-valid: the contract puts no minimum on this array.
								images: [],
								violations: [],
								recommendedFixes: []
							}
						}),
						{ status: 200, statusText: 'OK' }
					)
			)
		);
		const packageSpy = vi.spyOn(outputPackagingAdapter, 'package');

		await studio.handleGeneratePage();

		expect(packageSpy).not.toHaveBeenCalled();
		expect(studio.generationError).toBe(
			'Meechie sent the words back without a picture. Try creating the page again.'
		);
		// The trace still shows what was asked for, so the failure is diagnosable.
		expect(studio.assembledPrompt).toBe('the assembled prompt');
	});

	it('clears the whole export row when the page is replaced', async () => {
		const studio = arrangeGeneratedPage();
		vi.spyOn(outputPackagingAdapter, 'package').mockResolvedValue({
			ok: false,
			error: { code: 'CANVAS_UNAVAILABLE', message: 'no canvas' }
		});

		await studio.handleGeneratePage();
		expect(studio.exportError).not.toBe('');

		studio.handleModeSelect(studio.weeklyModes[1].id);

		// The files, the described row, the failure sentence and the shared file name all go, because
		// all four are derived from the one thing `resetGeneratedPage` clears.
		expect(studio.packagedFiles).toEqual([]);
		expect(studio.pageExports).toEqual([]);
		expect(studio.exportError).toBe('');
		expect(studio.pageFileBaseName).toBe('');
	});
});

describe('StudioState AI budget meter', () => {
	/** A fixed instant, so a reset time is arithmetic rather than a race with the suite's clock. */
	const NOW_MS = 1_760_000_000_000;

	// None of this had a single test before. The counter it replaces called the first verdict a
	// revision, never refilled, described itself as being "for this page", and showed a number the
	// server had never agreed to — and the suite around it stayed green through six rebuilds of
	// other features.

	/** A studio-text response carrying whatever quota headers the case is about. */
	const studioTextResponse = (
		quotaHeaders: Record<string, string> = {
			'RateLimit-Limit': '20',
			'RateLimit-Remaining': '14',
			'RateLimit-Reset': '45'
		},
		init: { status?: number } = {}
	): Response =>
		new Response(JSON.stringify({ ok: true, value: DEFAULT_STUDIO_TEXT_OUTPUT }), {
			status: init.status ?? 200,
			statusText: 'OK',
			headers: quotaHeaders
		});

	/** A studio with evidence in the box, ready to run a text action. */
	const arrangeStudioWithEvidence = (): StudioState => {
		const studio = new StudioState();
		studio.evidence = 'He said he was working late.';
		return studio;
	};

	it('does not spend a rewrite on the verdict that starts the round', async () => {
		const studio = arrangeStudioWithEvidence();
		vi.stubGlobal('fetch', vi.fn().mockImplementation(() => Promise.resolve(studioTextResponse())));

		await studio.runTextAction('generate_text');

		expect(studio.textOutput).not.toBeNull();
		expect(studio.revisionBudget).toBe(3);
	});

	it('spends one rewrite per rework of the verdict on screen', async () => {
		const studio = arrangeStudioWithEvidence();
		vi.stubGlobal('fetch', vi.fn().mockImplementation(() => Promise.resolve(studioTextResponse())));

		await studio.runTextAction('generate_text');
		await studio.runTextAction('make_meaner');
		expect(studio.revisionBudget).toBe(2);
		await studio.runTextAction('make_prettier');
		await studio.runTextAction('regenerate');
		expect(studio.revisionBudget).toBe(0);
		expect(studio.canMakeMoreSpecific).toBe(false);

		// And the way out that the on-screen message promises actually works.
		expect(studio.canGenerateText).toBe(true);
		await studio.runTextAction('generate_text');
		expect(studio.revisionBudget).toBe(3);
		expect(studio.canMakeMoreSpecific).toBe(true);
	});

	// The dead end this closes: spend the allowance, switch mode, and the switch deletes the
	// verdict the spend was for while leaving every AI button disabled — an empty studio the reader
	// had no way to fill.
	it('refills the rewrites when a mode switch throws the verdict away', async () => {
		const studio = arrangeStudioWithEvidence();
		vi.stubGlobal('fetch', vi.fn().mockImplementation(() => Promise.resolve(studioTextResponse())));

		await studio.runTextAction('generate_text');
		await studio.runTextAction('make_meaner');
		await studio.runTextAction('make_prettier');
		await studio.runTextAction('regenerate');
		expect(studio.revisionBudget).toBe(0);

		studio.handleModeSelect(studio.weeklyModes[1].id);

		expect(studio.textOutput).toBeNull();
		expect(studio.revisionBudget).toBe(3);
		expect(studio.canGenerateText).toBe(true);
	});

	it('gives a reopened saved page its own rewrites', async () => {
		const studio = arrangeStudioWithEvidence();
		vi.stubGlobal('fetch', vi.fn().mockImplementation(() => Promise.resolve(studioTextResponse())));
		await studio.runTextAction('generate_text');
		await studio.runTextAction('make_meaner');
		await studio.runTextAction('make_prettier');
		await studio.runTextAction('regenerate');
		expect(studio.revisionBudget).toBe(0);
		vi.unstubAllGlobals();

		await studio.loadCreation({
			id: 'saved-1',
			createdAtISO: '2026-09-01T00:00:00.000Z',
			intent: buildSeedSpec(DEFAULT_STUDIO_TEXT_OUTPUT),
			assembledPrompt: 'prompt for saved-1',
			owner: { kind: 'anonymous', sessionId: 'budget-session' }
		});

		expect(studio.revisionBudget).toBe(3);
	});

	it('charges nothing for an action the provider refused', async () => {
		const studio = arrangeStudioWithEvidence();
		vi.stubGlobal('fetch', vi.fn().mockImplementation(() => Promise.resolve(studioTextResponse())));
		await studio.runTextAction('generate_text');
		await studio.runTextAction('make_meaner');
		expect(studio.revisionBudget).toBe(2);

		vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('provider unavailable')));
		await studio.runTextAction('make_prettier');

		expect(studio.textError).not.toBe('');
		expect(studio.revisionBudget).toBe(2);
	});

	it('reports the quota the server actually sent, not one of its own', async () => {
		const studio = arrangeStudioWithEvidence();
		// Before any call there is nothing to report, and nothing is what it says.
		expect(studio.aiQuotaMessage).toBe('');

		vi.stubGlobal(
			'fetch',
			vi.fn().mockImplementation(() =>
				Promise.resolve(
					studioTextResponse({
						'RateLimit-Limit': '20',
						'RateLimit-Remaining': '14',
						'RateLimit-Reset': '45'
					})
				)
			)
		);
		await studio.runTextAction('generate_text');

		// 14 units at 2 units an action. The old counter would have said "2 left" here.
		expect(studio.aiQuota?.remaining).toBe(14);
		expect(studio.aiQuotaMessage).toContain('7 AI calls left');
	});

	it('keeps the last good reading when a response carries no quota headers', async () => {
		const studio = arrangeStudioWithEvidence();
		vi.stubGlobal('fetch', vi.fn().mockImplementation(() => Promise.resolve(studioTextResponse())));
		await studio.runTextAction('generate_text');
		const reported = studio.aiQuota;
		expect(reported).not.toBeNull();

		vi.stubGlobal('fetch', vi.fn().mockImplementation(() => Promise.resolve(studioTextResponse({}))));
		await studio.runTextAction('make_meaner');

		// Blanking the meter on one odd reply would tell the reader less than the last true thing
		// it knew.
		expect(studio.aiQuota).toEqual(reported);
	});
	// --- Codex review round on 34bd3ce -----------------------------------------------------------

	it('stops showing a quota reading once its own window has run out', async () => {
		const clock = createMockClockSeam(NOW_MS);
		const studio = arrangeStudioWithEvidence();
		studio.clock = clock;
		vi.stubGlobal(
			'fetch',
			vi.fn().mockImplementation(() =>
				Promise.resolve(
					studioTextResponse({
						'RateLimit-Limit': '20',
						'RateLimit-Remaining': '0',
						'RateLimit-Reset': '45',
						'Retry-After': '45'
					})
				)
			)
		);

		await studio.runTextAction('generate_text');
		expect(studio.aiQuotaMessage).toContain("Meechie's desk is full");

		// The reader does the sensible thing and waits. The fixed window refills on its own, and
		// the message has to stop claiming otherwise without another request being made.
		clock.advanceTo(NOW_MS + 45_000);

		expect(studio.aiQuota).toBeNull();
		expect(studio.aiQuotaMessage).toBe('');
	});

	it('anchors the reset instant at the request, not at the response', async () => {
		const clock = createMockClockSeam(NOW_MS);
		const studio = arrangeStudioWithEvidence();
		studio.clock = clock;
		// A slow provider call: the server charged the bucket and computed a 45s reset before it
		// started, and 55 seconds pass before the answer reaches the browser.
		vi.stubGlobal(
			'fetch',
			vi.fn().mockImplementation(() => {
				clock.setInstantWithoutFiring(NOW_MS + 55_000);
				return Promise.resolve(
					studioTextResponse({
						'RateLimit-Limit': '20',
						'RateLimit-Remaining': '14',
						'RateLimit-Reset': '45'
					})
				);
			})
		);

		await studio.runTextAction('generate_text');

		// Anchored at the response this would read NOW+100s — a window that closed 55 seconds ago
		// reported as still a minute and a half away.
		expect(studio.aiQuota?.resetAtMs).toBe(NOW_MS + 45_000);
	});

	it('renders the reset instant to the second, because the window is only sixty of them', async () => {
		const clock = createMockClockSeam(NOW_MS);
		const studio = arrangeStudioWithEvidence();
		studio.clock = clock;
		vi.stubGlobal(
			'fetch',
			vi.fn().mockImplementation(() =>
				Promise.resolve(
					studioTextResponse({
						'RateLimit-Limit': '20',
						'RateLimit-Remaining': '14',
						'RateLimit-Reset': '45'
					})
				)
			)
		);

		await studio.runTextAction('generate_text');

		const shown = new Date(NOW_MS + 45_000).toLocaleTimeString([], {
			hour: 'numeric',
			minute: '2-digit',
			second: '2-digit'
		});
		expect(studio.aiQuotaMessage).toContain(shown);
		// Truncating to the minute would drop these, and invite a retry up to 59 seconds early.
		expect(shown).toMatch(/\d{2}:\d{2}/);
	});
	// The panel said the desk was full while the buttons still submitted — the same disagreement
	// between the screen and the server that this feature exists to end.
	it('refuses the click the server has already said it will refuse', async () => {
		const clock = createMockClockSeam(NOW_MS);
		const studio = arrangeStudioWithEvidence();
		studio.clock = clock;
		vi.stubGlobal(
			'fetch',
			vi.fn().mockImplementation(() =>
				Promise.resolve(
					studioTextResponse({
						'RateLimit-Limit': '20',
						'RateLimit-Remaining': '0',
						'RateLimit-Reset': '45',
						'Retry-After': '45'
					})
				)
			)
		);

		await studio.runTextAction('generate_text');
		expect(studio.aiQuotaExhausted).toBe(true);
		expect(studio.aiQuotaMessage).toContain("Meechie's desk is full");
		// The sentence and the guard now read the same number.
		expect(studio.canGenerateText).toBe(false);
		expect(studio.canRegenerateText).toBe(false);
		expect(studio.canMakeMeaner).toBe(false);

		// And the block lifts by itself when the window it came from closes, without needing a
		// refused request to teach the page that the bucket refilled.
		clock.advanceTo(NOW_MS + 45_000);
		expect(studio.aiQuotaExhausted).toBe(false);
		expect(studio.canGenerateText).toBe(true);
	});

	// A bucket with one unit left cannot pay for a two-unit action, so the guard has to treat it
	// as exhausted even though the bucket is not empty.
	it('treats a bucket too low to pay for an action as exhausted', async () => {
		const clock = createMockClockSeam(NOW_MS);
		const studio = arrangeStudioWithEvidence();
		studio.clock = clock;
		vi.stubGlobal(
			'fetch',
			vi.fn().mockImplementation(() =>
				Promise.resolve(
					studioTextResponse({
						'RateLimit-Limit': '20',
						'RateLimit-Remaining': '1',
						'RateLimit-Reset': '20'
					})
				)
			)
		);

		await studio.runTextAction('generate_text');

		expect(studio.aiQuotaExhausted).toBe(true);
		expect(studio.canGenerateText).toBe(false);
	});

	// "Not known" must never block: before the server has said anything, and after a reading has
	// expired, the studio works exactly as it did.
	it('never blocks on a quota it has not been told about', () => {
		const studio = arrangeStudioWithEvidence();

		expect(studio.aiQuota).toBeNull();
		expect(studio.aiQuotaExhausted).toBe(false);
		expect(studio.canGenerateText).toBe(true);
	});
	// A rewrite in flight belongs to the round it was asked about. Switching mode mid-request used
	// to land the old mode's verdict on the new one and charge the new round's allowance for it.
	it('drops a reply for a round the reader has walked away from', async () => {
		const studio = arrangeStudioWithEvidence();
		vi.stubGlobal(
			'fetch',
			vi.fn().mockImplementation(() => Promise.resolve(studioTextResponse()))
		);
		await studio.runTextAction('generate_text');
		expect(studio.revisionBudget).toBe(3);

		// A rewrite that has not come back yet.
		let release: (value: Response) => void = () => {};
		vi.stubGlobal(
			'fetch',
			vi.fn().mockImplementation(
				() =>
					new Promise<Response>((resolve) => {
						release = resolve;
					})
			)
		);
		const pending = studio.runTextAction('make_meaner');

		// The reader moves on before it lands.
		studio.handleModeSelect(studio.weeklyModes[1].id);
		expect(studio.textOutput).toBeNull();
		expect(studio.revisionBudget).toBe(3);

		release(studioTextResponse());
		await pending;

		// None of the discarded round's reply lands on the round the reader is now looking at.
		expect(studio.textOutput).toBeNull();
		expect(studio.revisionBudget).toBe(3);
		// And the flag it owned is released, so the new mode is usable.
		expect(studio.isTextWorking).toBe(false);
		expect(studio.canGenerateText).toBe(true);
	});

	it('does not surface a walked-away-from round\'s failure on the new one', async () => {
		const studio = arrangeStudioWithEvidence();
		let fail: (reason: Error) => void = () => {};
		vi.stubGlobal(
			'fetch',
			vi.fn().mockImplementation(
				() =>
					new Promise<Response>((_resolve, reject) => {
						fail = reject;
					})
			)
		);
		const pending = studio.runTextAction('generate_text');

		studio.handleModeSelect(studio.weeklyModes[1].id);
		fail(new Error('provider unavailable'));
		await pending;

		expect(studio.textError).toBe('');
	});

	// The quota is about the caller, not the round: the server charged the bucket whatever the
	// reader did next, so that reading stays true and must survive the discard.
	it('still records the quota from a reply it otherwise discards', async () => {
		const clock = createMockClockSeam(NOW_MS);
		const studio = arrangeStudioWithEvidence();
		studio.clock = clock;
		let release: (value: Response) => void = () => {};
		vi.stubGlobal(
			'fetch',
			vi.fn().mockImplementation(
				() =>
					new Promise<Response>((resolve) => {
						release = resolve;
					})
			)
		);
		const pending = studio.runTextAction('generate_text');

		studio.handleModeSelect(studio.weeklyModes[1].id);
		release(
			studioTextResponse({
				'RateLimit-Limit': '20',
				'RateLimit-Remaining': '14',
				'RateLimit-Reset': '45'
			})
		);
		await pending;

		expect(studio.textOutput).toBeNull();
		expect(studio.aiQuota?.remaining).toBe(14);
		expect(studio.aiQuotaMessage).toContain('7 AI calls left');
	});
});
