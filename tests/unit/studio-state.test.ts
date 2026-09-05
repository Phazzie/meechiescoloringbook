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
import { specValidationAdapter } from '../../src/lib/adapters/spec-validation-seam';
import { MAX_DEDICATION_LENGTH } from '../../src/lib/seams/spec-validation-seam/contract';
import { StudioState } from '../../src/routes/studio-state.svelte';
import { VAULT_CAPACITY } from '../../src/lib/core/vault-gallery';
import type { CreationRecord, DraftRecord } from '../../contracts/creation-store.contract';
import type { MeechieStudioTextOutput } from '../../contracts/meechie-studio-text.contract';
import type { Wig } from '../../src/lib/seams/wig-catalog-seam/contract';
import type { StyleSelection } from '../../src/lib/core/page-style';

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
			error: null,
			pageSize: 'US_Letter'
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
	// `settingsError` and `settingsIssues` are the Page Controls panel's two report regions, and the
	// field's own doc comment claimed they were written only by the panel's handler. They were not:
	// the wig selector and the try-on page generator both called that handler for its rebuild, and
	// got its reporting with it. These two cover the halves of that — one writes into the panel about
	// something it does not own, the other wipes what the panel is already saying.
	// One character over the limit, so the page genuinely fails its check for a reason that has
	// nothing to do with Page Controls — the reader typed it into the dedication box.
	const OVERLONG_DEDICATION = 'D'.repeat(MAX_DEDICATION_LENGTH + 1);

	it('does not report a wig change under Page Controls', async () => {
		const studio = await initVault([]);

		studio.handleDedicationInput(OVERLONG_DEDICATION);
		await vi.waitFor(() => expect(studio.validationIssues.length).toBeGreaterThan(0));

		// The panel is quiet, correctly — the reader has not touched a Page Control.
		expect(studio.settingsIssues).toEqual([]);

		await studio.selectWigForTryOn(SAMPLE_WIG);

		// The wig belongs to the try-on studio; the panel's summary deliberately does not even name
		// it. Reporting here read as "That change was applied. The page did not pass its check" over
		// a row of controls the reader never went near.
		expect(studio.settingsIssues).toEqual([]);
		expect(studio.settingsError).toBe('');
		// And the failure is still reported — through the field that always carried it.
		expect(studio.validationIssues.length).toBeGreaterThan(0);
	});

	it('does not report a refused try-on generation under Page Controls', async () => {
		const studio = await initVault([]);

		studio.handleDedicationInput(OVERLONG_DEDICATION);
		await vi.waitFor(() => expect(studio.validationIssues.length).toBeGreaterThan(0));

		await makeTryOnPage(studio);

		// The generation is refused — no portrait reached the paper — and says so on the try-on
		// studio's own line.
		expect(studio.images).toHaveLength(0);
		expect(studio.generationError).toBe('Fix the page settings before generating.');
		// It used to say so twice. `handleGenerateTryOnPage` rebuilt the spec through the panel's
		// handler, which copied the finding into `settingsIssues` — so pressing a try-on button
		// printed "That change was applied. The page did not pass its check" under a row of controls
		// the reader had not touched, alongside the correct message above.
		expect(studio.settingsIssues).toEqual([]);
		expect(studio.settingsError).toBe('');
	});

	it('clears a failed wig pick when the reader retries the wig already selected', async () => {
		// Re-picking the selected wig is how a reader retries after seeing that line, and it is the
		// one path that did not clear it: `resetGeneratedPage` clears the error along with the page,
		// but only runs when the wig actually changed. So a rebuild that failed once stayed on screen
		// through every later success, indefinitely, describing an attempt that had already been
		// retried.
		const studio = await initVault([]);
		const validate = vi
			.spyOn(specValidationAdapter, 'validate')
			.mockRejectedValue(new Error('spec rebuild exploded'));

		await studio.selectWigForTryOn(SAMPLE_WIG);
		expect(studio.generationError).toBe('spec rebuild exploded');

		// Whatever made it fail is over, and the reader clicks the same wig again.
		validate.mockRestore();
		await studio.selectWigForTryOn(SAMPLE_WIG);

		expect(studio.selectedWigId).toBe(SAMPLE_WIG.id);
		expect(studio.generationError).toBe('');
	});

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

describe('StudioState page style', () => {
	const SESSION_ID = 'style-session';

	const PAGE_STYLE_PNG_BASE64 = Buffer.from(new Uint8Array(4096).fill(9)).toString('base64');

	const styleSelection = {
		themeId: 'receipts',
		voice: {
			intensity: 'no_mercy' as const,
			rawness: 'raw' as const,
			thirdPerson: 'always' as const
		},
		glitter: true
	};

	const makeStyledCreation = (overrides: Partial<CreationRecord> = {}): CreationRecord => ({
		id: 'styled-page',
		createdAtISO: '2026-09-01T00:00:00.000Z',
		intent: { ...buildSeedSpec(DEFAULT_STUDIO_TEXT_OUTPUT), title: 'A STYLED PAGE' },
		assembledPrompt: 'prompt for styled-page',
		studioText: DEFAULT_STUDIO_TEXT_OUTPUT,
		owner: { kind: 'anonymous', sessionId: SESSION_ID },
		...overrides
	});

	/**
	 * The same record with a picture actually on it.
	 *
	 * Several tests below are about what a *finished page* does when a control moves, and were
	 * written against the image-less record above — so they passed for a reason next to the one they
	 * describe. A record with no picture has no artifact for a later control change to contradict,
	 * and now behaves accordingly (see `loadCreation`), which is what separated the two.
	 *
	 * Real PNG bytes, because `restoreCreationImages` checks the byte signature and drops anything it
	 * cannot recognise — a stub payload would restore no picture and put the fixture straight back
	 * where it was.
	 */
	const makePicturedCreation = (overrides: Partial<CreationRecord> = {}): CreationRecord =>
		makeStyledCreation({
			images: [{ b64: ONE_PIXEL_PNG_BASE64 }],
			...overrides
		});

	/**
	 * Runs a real generation so the page on screen has a prompt and a picture.
	 *
	 * The style is now captured where the artifact is made, so a test that wants a *saveable* page
	 * has to make one. Assigning `assembledPrompt` by hand produced a page with no recorded style,
	 * which is exactly the state the code now refuses to file under the live controls.
	 */
	const generatePage = async (studio: StudioState): Promise<void> => {
		studio.textOutput = { ...DEFAULT_STUDIO_TEXT_OUTPUT };
		vi.stubGlobal(
			'fetch',
			vi.fn().mockImplementation(
				async () =>
					new Response(
						JSON.stringify({
							ok: true,
							value: {
								prompt: 'the prompt this page was made with',
								templateVersion: 'v2',
								images: [
									{
										id: 'image-1',
										format: 'png',
										mimeType: 'image/png',
										data: PAGE_STYLE_PNG_BASE64,
										encoding: 'base64'
									}
								],
								violations: [],
								recommendedFixes: []
							}
						}),
						{ status: 200, statusText: 'OK' }
					)
			)
		);
		await studio.handleGeneratePage();
	};

	afterEach(() => {
		destroyInitializedStudios();
		vi.unstubAllGlobals();
		vi.restoreAllMocks();
	});

	/**
	 * An initialised studio with a session, and a spy on the vault write.
	 *
	 * Six lines repeated verbatim in every test that asserts on what reaches the vault. Extracted
	 * because a saved record's provenance is what this block is about, and the setup was starting to
	 * outweigh the assertion in each one.
	 */
	const savingStudio = async () => {
		vi.spyOn(sessionAdapter, 'getSession').mockResolvedValue({
			ok: true,
			value: { sessionId: SESSION_ID }
		});
		const studio = registerInitialized(new StudioState());
		await studio.init();
		return { studio, saveSpy: vi.spyOn(creationStoreAdapter, 'saveCreation') };
	};

	/**
	 * The controls set to `styleSelection`, with no page made from them yet.
	 *
	 * Every test in this block that is about provenance has to put a *known* style on the controls
	 * first, and they were each spelling out the same three assignments — including the voice
	 * literal, which is `styleSelection.voice` and now says so. A test whose setup silently drifted
	 * from the constant it asserts against would be green for the wrong reason.
	 */
	const putStyleOnControls = (studio: StudioState): void => {
		studio.selectedThemeId = styleSelection.themeId;
		studio.voice = { ...styleSelection.voice };
		studio.glitter = styleSelection.glitter;
	};

	/**
	 * A saving studio with a real page on the paper, made from `styleSelection`.
	 *
	 * The prologue of every test about what a *finished* page files itself under. It has to be a
	 * real generation rather than an assigned prompt — see `generatePage` — so it is seven lines
	 * before the test's own first sentence, repeated verbatim each time.
	 */
	const styledPageOnScreen = async () => {
		const saving = await savingStudio();
		putStyleOnControls(saving.studio);
		await generatePage(saving.studio);
		return saving;
	};

	/**
	 * The reader changes their mind after the picture exists, and does not regenerate.
	 *
	 * The move at the centre of this whole block: it is the moment the controls and the page stop
	 * describing the same thing, and what each writer does about that is what the tests below are
	 * checking. Named because "which theme" is not the point of it — "after, without regenerating"
	 * is.
	 */
	const restyleWithoutRegenerating = async (studio: StudioState): Promise<void> => {
		studio.selectedThemeId = 'church-glam';
		studio.glitter = false;
		await studio.syncSpecFromCurrentText('theme');
	};

	/**
	 * A saving studio started from a stored draft, which is what a refresh actually is.
	 *
	 * `initFromDraft` writes to localStorage and builds a bare studio; this stubs the seam and adds
	 * the session, because a draft-restore test that is about what gets *saved* next needs both. The
	 * draft body was written out twice verbatim, so the one field each test varies — the style — is
	 * the parameter, and the rest cannot drift between them.
	 */
	const initFromStoredDraft = async (draftStyle: StyleSelection | undefined) => {
		vi.spyOn(creationStoreAdapter, 'getDraft').mockResolvedValue({
			ok: true,
			value: {
				updatedAtISO: '2026-09-01T00:00:00.000Z',
				intent: { ...buildSeedSpec(DEFAULT_STUDIO_TEXT_OUTPUT), title: 'A DRAFTED PAGE' },
				studioText: DEFAULT_STUDIO_TEXT_OUTPUT,
				styleSelection: draftStyle
			}
		});
		return savingStudio();
	};

	it('saves the theme, voice and glitter that composed the page', async () => {
		const { studio, saveSpy } = await styledPageOnScreen();

		await studio.saveToVault();

		expect(saveSpy.mock.calls[0][0].record.styleSelection).toEqual(styleSelection);
	});

	it('records the wig in the saved style when one was on the page', async () => {
		const { studio, saveSpy } = await savingStudio();

		studio.selectedWig = SAMPLE_WIG;
		await generatePage(studio);
		await studio.saveToVault();

		// The two strings the hint prints, and deliberately not the catalog id.
		expect(saveSpy.mock.calls[0][0].record.styleSelection?.wig).toEqual({
			name: SAMPLE_WIG.name,
			style: SAMPLE_WIG.style
		});
	});

	it('puts a reopened page back on the controls that made it', async () => {
		const studio = registerInitialized(new StudioState());
		await studio.init();

		await studio.loadCreation(makeStyledCreation({ styleSelection }));

		expect(studio.selectedThemeId).toBe('receipts');
		expect(studio.voice).toEqual(styleSelection.voice);
		expect(studio.glitter).toBe(true);
		expect(studio.styleSelectionUnknown).toBe(false);
	});

	it('keeps a reopened page looking the same when an unrelated control changes', async () => {
		// The defect this run exists to fix. `applyTextToSpec` recomposes the style hint from the
		// live controls on every setting change, so a reopened page whose controls had reset to the
		// defaults was restyled by a page-size change — one control moved, five moved underneath.
		const studio = registerInitialized(new StudioState());
		await studio.init();
		await studio.loadCreation(makeStyledCreation({ styleSelection }));

		const generateSpy = vi.spyOn(globalThis, 'fetch');
		studio.pageSize = 'A4';
		await studio.syncSpecFromCurrentText('setting');
		generateSpy.mockRestore();

		expect(studio.selectedThemeId).toBe('receipts');
		expect(studio.voice.intensity).toBe('no_mercy');
		expect(studio.glitter).toBe(true);
		// And the size the reader actually asked for did change.
		expect(studio.spec.pageSize).toBe('A4');
	});

	it('keeps a reopened page on its wig for hint purposes without re-selecting the wig', async () => {
		const studio = registerInitialized(new StudioState());
		await studio.init();

		await studio.loadCreation(
			makePicturedCreation({
				styleSelection: { ...styleSelection, wig: { name: 'Honey Drip', style: 'body wave' } }
			})
		);

		// The try-on studio is untouched — nothing re-selects a wig the reader has not chosen.
		expect(studio.selectedWig).toBeNull();
		// But the page's own look still carries it, so the next setting change cannot drop it.
		expect(studio.currentStyleSelection().wig).toEqual({ name: 'Honey Drip', style: 'body wave' });
	});

	it('says a page saved before styles were stored has no style on file, and touches nothing', async () => {
		const studio = registerInitialized(new StudioState());
		await studio.init();
		studio.voice = { intensity: 'church_lady', rawness: 'medium', thirdPerson: 'never' };
		studio.selectedThemeId = 'main-character';

		await studio.loadCreation(makeStyledCreation());

		expect(studio.styleSelectionUnknown).toBe(true);
		// The controls are the reader's, not the record's. Resetting them to the defaults here was
		// the first attempt and threw away settings the reader had just chosen.
		expect(studio.selectedThemeId).toBe('main-character');
		expect(studio.voice.intensity).toBe('church_lady');
	});

	it('clears the unknown-style notice once a page the studio authored replaces it', async () => {
		const studio = registerInitialized(new StudioState());
		await studio.init();
		await studio.loadCreation(makeStyledCreation());
		expect(studio.styleSelectionUnknown).toBe(true);

		studio.handleModeSelect(studio.weeklyModes[1].id);

		expect(studio.styleSelectionUnknown).toBe(false);
	});

	it('round-trips the style through the draft, so a refresh does not restyle the page', async () => {
		const studio = registerInitialized(new StudioState());
		await studio.init();
		const draftSpy = vi.spyOn(creationStoreAdapter, 'saveDraft');
		studio.selectedThemeId = 'receipts';
		studio.voice = { intensity: 'no_mercy', rawness: 'raw', thirdPerson: 'always' };
		studio.glitter = true;
		draftSpy.mockClear();
		await studio.syncSpecFromCurrentText('setting');
		// The draft save is debounced behind a timer, so the write is not on the spy yet.
		await vi.waitFor(() => expect(draftSpy).toHaveBeenCalled());

		const savedDraft = draftSpy.mock.calls.at(-1)?.[0].draft;
		expect(savedDraft?.styleSelection).toEqual(styleSelection);

		const refreshed = await initFromDraft(savedDraft!);
		expect(refreshed.selectedThemeId).toBe('receipts');
		expect(refreshed.voice).toEqual(styleSelection.voice);
		expect(refreshed.glitter).toBe(true);
		expect(refreshed.styleSelectionUnknown).toBe(false);
	});

	it('seeds the density derivation from the restored style, not from the defaults', async () => {
		// Order matters inside the restore: `lastDerivesDense` is read from the live controls, so
		// seeding it before the style is applied describes a page that was never on screen — and
		// that seed is what the next setting change is decided against.
		const studio = registerInitialized(new StudioState());
		await studio.init();
		const dense = {
			...buildSeedSpec(DEFAULT_STUDIO_TEXT_OUTPUT),
			decorations: 'dense' as const
		};

		await studio.loadCreation(
			makeStyledCreation({
				intent: dense,
				styleSelection: {
					themeId: 'receipts',
					voice: { intensity: 'no_mercy', rawness: 'raw', thirdPerson: 'always' },
					glitter: false
				}
			})
		);

		// `receipts` puts `receipt` in the hint, so the restored page is correctly seeded dense and
		// an unrelated change leaves it dense.
		studio.pageSize = 'A4';
		await studio.syncSpecFromCurrentText('setting');
		expect(studio.spec.decorations).toBe('dense');
	});

	it('reports a failed settings change beside the controls, not as a draft problem', async () => {
		const studio = registerInitialized(new StudioState());
		await studio.init();
		// `saveDraft` catches its own failures, so the way to fail a settings change is to fail the
		// rebuild itself — the same module instance the studio validates through.
		vi.spyOn(specValidationAdapter, 'validate').mockRejectedValue(
			new Error('spec rebuild exploded')
		);

		// Resolves rather than rejects: the only caller is a DOM event handler, and rethrowing here
		// produced an unhandled rejection that told nobody anything.
		await expect(studio.syncSpecFromCurrentText('setting')).resolves.toBeUndefined();

		expect(studio.settingsError).toBe('spec rebuild exploded');
		expect(studio.draftSaveError).toBe('');
	});

	it('saves the style that produced the page, not the controls at save time', async () => {
		// The defect this PR exists to remove, one step further along: generate a page, then move a
		// control, then save. The image and the prompt are the old style's; reading the live controls
		// would file them under a style that never made them.
		const { studio, saveSpy } = await styledPageOnScreen();
		expect(studio.assembledPrompt).toBe('the prompt this page was made with');

		await restyleWithoutRegenerating(studio);
		await studio.saveToVault();

		expect(saveSpy.mock.calls[0][0].record.styleSelection).toEqual(styleSelection);
	});

	it('files the autosaved draft under the controls its own intent was built from', async () => {
		// The sibling of the test above, on the other writer, and the pairing goes the opposite way.
		// The vault stores the *artifact's* spec, so it files the artifact's style beside it. A draft
		// stores the *live* spec — it is work in progress, not a finished page — so filing the
		// artifact's style there put an intent rebuilt for the new theme next to the old theme's
		// selection. Restoring that draft reapplied the old theme over the new intent: the control
		// the reader had just moved undone on every refresh, and `decorations`, which is derived from
		// the style hint, describing a theme the stored selection contradicts.
		const { studio, saveSpy } = await styledPageOnScreen();

		const draftSpy = vi.spyOn(creationStoreAdapter, 'saveDraft');
		await restyleWithoutRegenerating(studio);
		await vi.waitFor(() => expect(draftSpy).toHaveBeenCalled());

		const savedDraft = draftSpy.mock.calls.at(-1)?.[0].draft;
		expect(savedDraft?.styleSelection).toEqual({
			themeId: 'church-glam',
			voice: styleSelection.voice,
			glitter: false
		});

		// The pairing is the point, so the round trip is what proves it: the draft comes back as the
		// reader left it rather than as the picture they did not remake.
		const refreshed = await initFromDraft(savedDraft!);
		expect(refreshed.selectedThemeId).toBe('church-glam');
		expect(refreshed.glitter).toBe(false);
		expect(refreshed.spec.decorations).toBe(savedDraft?.intent.decorations);

		// And the vault still files the picture under the style that made it — the two writers now
		// disagree on purpose, because they are storing two different specs.
		await studio.saveToVault();
		expect(saveSpy.mock.calls[0][0].record.styleSelection).toEqual(styleSelection);
	});

	it('records the style the request carried, not one chosen while it was in flight', async () => {
		// The Page Controls stay enabled during a generation and moving one does not advance
		// `pageLoadToken`, so reading the controls after the await recorded a style the picture was
		// not drawn from.
		//
		// Not `styledPageOnScreen`: this one needs its own fetch stub, because the control move has
		// to happen *inside* the request rather than after it.
		const { studio } = await savingStudio();
		putStyleOnControls(studio);
		studio.textOutput = { ...DEFAULT_STUDIO_TEXT_OUTPUT };

		let sentHint = '';
		vi.stubGlobal(
			'fetch',
			vi.fn().mockImplementation(async (_url: string, init?: RequestInit) => {
				sentHint = JSON.parse(String(init?.body)).styleHint;
				// The reader moves a control while the request is still in flight.
				studio.selectedThemeId = 'church-glam';
				studio.glitter = false;
				return new Response(
					JSON.stringify({
						ok: true,
						value: {
							prompt: 'the prompt this page was made with',
							templateVersion: 'v2',
							images: [
								{
									id: 'image-1',
									format: 'png',
									mimeType: 'image/png',
									data: PAGE_STYLE_PNG_BASE64,
									encoding: 'base64'
								}
							],
							violations: [],
							recommendedFixes: []
						}
					}),
					{ status: 200, statusText: 'OK' }
				);
			})
		);

		await studio.handleGeneratePage();
		expect(sentHint).toContain('receipt collage');

		const saveSpy = vi.spyOn(creationStoreAdapter, 'saveCreation');
		await studio.saveToVault();

		// The record matches the hint that was sent, not the controls as they ended up.
		expect(saveSpy.mock.calls[0][0].record.styleSelection).toEqual(styleSelection);
	});

	it('regenerates a reopened page with its own wig, not the one left in the carousel', async () => {
		// `handleGeneratePage` calls `resetGeneratedPage` first, which clears the restored wig
		// provenance. The theme, voice and glitter survive that reset because they live on the
		// controls, so the wig has to as well — otherwise the paid request describes a page that is
		// partly the record's and partly the carousel's.
		const studio = registerInitialized(new StudioState());
		await studio.init();
		await studio.loadCreation(
			makePicturedCreation({
				styleSelection: { ...styleSelection, wig: { name: 'Honey Drip', style: 'body wave' } }
			})
		);
		// A wig left selected in the carousel, without the reader picking it since the restore.
		studio.selectedWig = SAMPLE_WIG;

		let sentHint = '';
		vi.stubGlobal(
			'fetch',
			vi.fn().mockImplementation(async (_url: string, init?: RequestInit) => {
				sentHint = JSON.parse(String(init?.body)).styleHint;
				return new Response(
					JSON.stringify({
						ok: true,
						value: {
							prompt: 'a prompt',
							templateVersion: 'v2',
							images: [
								{
									id: 'image-1',
									format: 'png',
									mimeType: 'image/png',
									data: PAGE_STYLE_PNG_BASE64,
									encoding: 'base64'
								}
							],
							violations: [],
							recommendedFixes: []
						}
					}),
					{ status: 200, statusText: 'OK' }
				);
			})
		);

		await studio.handleGeneratePage();

		expect(sentHint).toContain('featuring Honey Drip (body wave)');
		expect(sentHint).not.toContain(SAMPLE_WIG.name);
	});

	it('saves the controls as the style of a page that never generated an image', async () => {
		// A verdict with no picture is saveable — `assembledPrompt` falls back to the quote — and it
		// has no artifact snapshot, because only the generate paths take one. Its controls did author
		// the spec being saved, so they are its style; filing it as "not on file" would report an
		// unknown for a page whose style is perfectly well known.
		const { studio, saveSpy } = await savingStudio();
		putStyleOnControls(studio);
		studio.textOutput = { ...DEFAULT_STUDIO_TEXT_OUTPUT };
		expect(studio.assembledPrompt).toBe('');
		expect(studio.styleSelectionUnknown).toBe(false);

		await studio.saveToVault();

		expect(saveSpy.mock.calls[0][0].record.styleSelection).toEqual(styleSelection);
	});

	it('still files a reopened page with no stored style as unknown when it is saved again', async () => {
		// The other side of the case above: here the prompt and picture came from choices nobody
		// wrote down, so the controls are the reader's and not the page's. Re-saving must not invent
		// provenance for it.
		const { studio, saveSpy } = await savingStudio();
		await studio.loadCreation(makeStyledCreation());
		expect(studio.styleSelectionUnknown).toBe(true);

		await studio.saveToVault();

		expect(saveSpy.mock.calls[0][0].record.styleSelection).toBeUndefined();
	});

	it('does not invent a style for the autosaved draft of a page that has none', async () => {
		// The sibling of the test above, and the case it did not cover: the vault applies that rule,
		// the autosaved draft wrote the live controls unconditionally. A draft is restored on every
		// refresh, so reopening a record with no stored style and waiting for the autosave brought the
		// page back after a reload wearing the reader's controls as its own — the unknown-style notice
		// gone, the invented values now restorable, and a later vault save able to pair them with that
		// record's intent for good.
		const { studio } = await savingStudio();

		const draftSpy = vi.spyOn(creationStoreAdapter, 'saveDraft');
		await studio.loadCreation(makeStyledCreation());
		expect(studio.styleSelectionUnknown).toBe(true);

		// `loadCreation` schedules the autosave itself, so this is the draft the reader gets without
		// touching anything at all.
		await vi.waitFor(() => expect(draftSpy).toHaveBeenCalled());
		expect(draftSpy.mock.calls[0][0].draft.styleSelection).toBeUndefined();
	});

	it('keeps a reopened page on its own wig provenance, even against a live selection', async () => {
		// `loadCreation` does not clear `selectedWig`, so a reader browsing wigs who then reopens a
		// page saved without one rebuilt that page's hint with the unrelated live wig.
		const studio = registerInitialized(new StudioState());
		await studio.init();
		studio.selectedWig = SAMPLE_WIG;

		await studio.loadCreation(makePicturedCreation({ styleSelection }));

		// The stored style had no wig, and that is provenance, not absence of information.
		expect(studio.currentStyleSelection().wig).toBeUndefined();
		// The try-on studio still shows what the reader was looking at. Compared by id: `selectedWig`
		// is `$state`, so it comes back as a proxy and is never identical to the source object.
		expect(studio.selectedWigId).toBe(SAMPLE_WIG.id);

		// Picking a wig is the reader taking it back, and the hint follows again.
		await studio.selectWigForTryOn(OTHER_WIG);
		expect(studio.currentStyleSelection().wig).toEqual({
			name: OTHER_WIG.name,
			style: OTHER_WIG.style
		});
	});

	it('does not send an invisible wig from a reopened page that has no picture', async () => {
		// A record saved from a verdict before any image was generated still records the live wig, so
		// its stored style can name one. Reopening it put that wig into the hint while the carousel
		// showed nothing selectable — the wig cannot go back into the carousel, because it is stored
		// as `{ name, style }` and not as a catalog entry. So Create Coloring Page sent a wig the
		// reader could neither see nor change, in a request they pay for.
		//
		// With no picture there is no artifact for the reader's selection to contradict, so the
		// visible selection is the one that counts. The wig provenance now sits inside the same image
		// guard as the other two snapshots, which is where it always belonged.
		const studio = registerInitialized(new StudioState());
		await studio.init();

		await studio.loadCreation(
			makeStyledCreation({ styleSelection: { ...styleSelection, wig: { name: 'Stored Wig', style: 'bob' } } })
		);

		// Nothing is selected on screen, so nothing rides along in the hint.
		expect(studio.selectedWigId).toBeNull();
		expect(studio.currentStyleSelection().wig).toBeUndefined();

		// And the reader's own choice still reaches it.
		await studio.selectWigForTryOn(SAMPLE_WIG);
		expect(studio.currentStyleSelection().wig).toEqual({
			name: SAMPLE_WIG.name,
			style: SAMPLE_WIG.style
		});
	});

	it('reports a page whose style is not on file, and stops once a new page is made', async () => {
		const studio = registerInitialized(new StudioState());
		await studio.init();
		expect(studio.styleSelectionUnknown).toBe(false);

		await studio.loadCreation(makeStyledCreation());
		expect(studio.styleSelectionUnknown).toBe(true);

		await studio.loadCreation(makeStyledCreation({ styleSelection }));
		expect(studio.styleSelectionUnknown).toBe(false);
	});

	it('puts a stored theme that no longer exists onto the control as its fallback', async () => {
		// The schema accepts an id a later release removed and `themeForSelection` falls back, so
		// assigning the dead id raw split the panel against itself: the summary named the fallback
		// while every chip compared against the dead id and reported not-pressed.
		const studio = registerInitialized(new StudioState());
		await studio.init();

		await studio.loadCreation(
			makeStyledCreation({
				styleSelection: { ...styleSelection, themeId: 'a-theme-that-was-deleted' }
			})
		);

		expect(studio.selectedThemeId).toBe(studioThemes[0].id);
		expect(studioThemes.some((theme) => theme.id === studio.selectedThemeId)).toBe(true);
	});

	it('clears a previous settings error when the next change succeeds', async () => {
		const studio = registerInitialized(new StudioState());
		await studio.init();
		studio.settingsError = 'something old';

		await studio.syncSpecFromCurrentText('setting');

		expect(studio.settingsError).toBe('');
	});

	it('saves the paper the picture was drawn for, not the paper the controls now show', async () => {
		// The style defect one field over: page size and border *are* persisted, but from the live
		// spec, which `applyTextToSpec` rebuilds on every setting change. So generating on US Letter
		// with a decorative border, switching to A4 with no border and saving filed the old image,
		// prompt and downloads under dimensions and a frame that never produced them.
		const { studio, saveSpy } = await savingStudio();

		studio.pageSize = 'US_Letter';
		studio.border = 'decorative';
		await generatePage(studio);

		studio.pageSize = 'A4';
		studio.border = 'none';
		await studio.syncSpecFromCurrentText('setting');
		// The controls and the spec on screen do move — the reader changed them, and the next page
		// will use them. It is the record that must describe the picture it is saved beside.
		expect(studio.spec.pageSize).toBe('A4');

		await studio.saveToVault();

		expect(saveSpy.mock.calls[0][0].record.intent.pageSize).toBe('US_Letter');
		expect(saveSpy.mock.calls[0][0].record.intent.border).toBe('decorative');
	});

	it('keeps a reopened page filed under its own paper when a control moves', async () => {
		// The same drift through the other door: a record's paper is in `intent`, so it is known
		// even for one written before styles were stored, and re-saving must not overwrite it with
		// whatever the panel says now.
		const { studio, saveSpy } = await savingStudio();

		await studio.loadCreation(
			makePicturedCreation({
				intent: {
					...buildSeedSpec(DEFAULT_STUDIO_TEXT_OUTPUT),
					title: 'A STYLED PAGE',
					pageSize: 'A4',
					border: 'plain'
				}
			})
		);
		studio.pageSize = 'US_Letter';
		await studio.syncSpecFromCurrentText('setting');
		await studio.saveToVault();

		expect(saveSpy.mock.calls[0][0].record.intent.pageSize).toBe('A4');
		expect(saveSpy.mock.calls[0][0].record.intent.border).toBe('plain');
	});

	it('keeps a reopened image-less page under the controls the reader just moved', async () => {
		// The mirror of the test above, and the case it was silently standing in for. A record saved
		// from a verdict before any image was generated has no picture, so there is no artifact for a
		// later control change to contradict — the reader's change is the only authorship there is.
		//
		// Snapshotting the record's intent on reopen made `saveToVault` prefer it over the rebuilt
		// live spec, so the reader changed Page Size, pressed save, and watched their change go
		// nowhere with no error and no explanation. Same shape as the snapshots taken on a restored
		// draft and on a failed generation, corrected two rounds earlier; this was the restore door.
		const { studio, saveSpy } = await savingStudio();

		await studio.loadCreation(
			makeStyledCreation({
				intent: {
					...buildSeedSpec(DEFAULT_STUDIO_TEXT_OUTPUT),
					title: 'A PAGE WITH NO PICTURE',
					pageSize: 'A4',
					border: 'plain'
				}
			})
		);
		studio.pageSize = 'US_Letter';
		await studio.syncSpecFromCurrentText('setting');
		await studio.saveToVault();

		expect(saveSpy.mock.calls[0][0].record.intent.pageSize).toBe('US_Letter');
	});

	it('never files a style and a decoration density that disagree about one picture', async () => {
		// `decorations` is derived from the style hint rather than chosen, so it is the field the
		// paper snapshot missed and the one that mattered most: generating under a dense theme,
		// switching to a minimal one and saving wrote a record whose `styleSelection` said Receipts
		// and whose `intent.decorations` said minimal, about the same image. A reopen then preserved
		// that contradiction, and a paid regeneration could be built from it.
		const { studio, saveSpy } = await savingStudio();

		studio.selectedThemeId = 'receipts';
		await generatePage(studio);
		expect(studio.spec.decorations).toBe('dense');

		// Both controls move, because the derivation reads the whole style hint: the default
		// intensity is `receipts_out`, which puts "receipt" in the hint on its own, so a theme
		// change alone cannot reach the minimal branch.
		studio.selectedThemeId = 'crown-energy';
		studio.voice = { ...studio.voice, intensity: 'no_mercy' };
		await studio.syncSpecFromCurrentText('theme');
		expect(studio.spec.decorations).toBe('minimal');

		await studio.saveToVault();

		const record = saveSpy.mock.calls[0][0].record;
		expect(record.styleSelection?.themeId).toBe('receipts');
		expect(record.intent.decorations).toBe('dense');
	});

	it('keeps the dedication the reader typed, which is theirs rather than the artifact’s', async () => {
		// The one field deliberately taken from the live spec instead of the snapshot. A dedication
		// entered after generating is on no page either way; silently dropping what the reader just
		// typed would be a different defect from the one the snapshot removes.
		const { studio, saveSpy } = await savingStudio();

		await generatePage(studio);
		studio.handleDedicationInput('For the group chat');
		await studio.saveToVault();

		expect(saveSpy.mock.calls[0][0].record.intent.dedication).toBe('For the group chat');
	});

	it('leaves no empty dedication key on a record that has none', async () => {
		// `{ ...spec, dedication: undefined }` keeps the key, and an optional schema accepts it — so
		// the record would carry a field it does not have.
		const { studio, saveSpy } = await savingStudio();

		await generatePage(studio);
		await studio.saveToVault();

		expect('dedication' in saveSpy.mock.calls[0][0].record.intent).toBe(false);
	});

	it('lets an edited draft save the style it is now wearing', async () => {
		// A restored draft used to be filed as though an artifact existed: it put its stored style
		// on the controls *and* recorded it as the page's. Drafts restore no prompt and no image, so
		// a reader who came back after a refresh, changed a theme and saved got a record holding the
		// draft's old style beside a spec rebuilt from the new controls.
		const { studio, saveSpy } = await initFromStoredDraft(styleSelection);

		// The draft's style is on the controls, which is the half that was always right.
		expect(studio.selectedThemeId).toBe('receipts');
		// And no page exists, so nothing is reported as having a style that is not on file.
		expect(studio.styleSelectionUnknown).toBe(false);

		studio.selectedThemeId = 'crown-energy';
		await studio.syncSpecFromCurrentText('theme');
		await studio.saveToVault();

		expect(saveSpy.mock.calls[0][0].record.styleSelection?.themeId).toBe('crown-energy');
	});

	it('files nothing under a generation that came back without a picture', async () => {
		// The prompt is assigned before the no-picture check on purpose, so System Trace still shows
		// what was asked for. The artifact snapshot must not be: `textOutput` keeps Save to Vault
		// lit, so saving after the failure filed the failed request's style and spec — and went on
		// doing so after the reader had moved every control.
		const { studio, saveSpy } = await savingStudio();

		studio.textOutput = { ...DEFAULT_STUDIO_TEXT_OUTPUT };
		studio.selectedThemeId = 'receipts';
		vi.stubGlobal(
			'fetch',
			vi.fn().mockImplementation(
				async () =>
					new Response(
						JSON.stringify({
							ok: true,
							value: {
								prompt: 'the prompt that produced nothing',
								templateVersion: 'v2',
								images: [],
								violations: [],
								recommendedFixes: []
							}
						}),
						{ status: 200, statusText: 'OK' }
					)
			)
		);
		await studio.handleGeneratePage();

		expect(studio.generationError).toContain('without a picture');
		// The trace kept what was asked for; the panel did not gain a page to describe.
		expect(studio.assembledPrompt).toBe('the prompt that produced nothing');
		expect(studio.styleSelectionUnknown).toBe(false);

		studio.selectedThemeId = 'crown-energy';
		await studio.syncSpecFromCurrentText('theme');
		await studio.saveToVault();

		expect(saveSpy.mock.calls[0][0].record.styleSelection?.themeId).toBe('crown-energy');
	});

	it('packages the downloads for the paper the picture was drawn on', async () => {
		// The snapshot kept the record honest; the packaging call was still reading the live spec, so
		// a Page Size moved while the generation was in flight produced a PDF and a share image for
		// different paper than the image and the saved intent.
		const { studio } = await savingStudio();
		const packageSpy = vi
			.spyOn(outputPackagingAdapter, 'package')
			.mockResolvedValue({ ok: true, value: { files: [] } });

		studio.pageSize = 'US_Letter';
		studio.textOutput = { ...DEFAULT_STUDIO_TEXT_OUTPUT };
		vi.stubGlobal(
			'fetch',
			vi.fn().mockImplementation(async () => {
				// The reader moves Page Size while the request is in flight. Nothing advances
				// `pageLoadToken`, so the generation is still the one that lands.
				studio.pageSize = 'A4';
				await studio.syncSpecFromCurrentText('setting');
				return new Response(
					JSON.stringify({
						ok: true,
						value: {
							prompt: 'the prompt this page was made with',
							templateVersion: 'v2',
							images: [
								{
									id: 'image-1',
									format: 'png',
									mimeType: 'image/png',
									data: PAGE_STYLE_PNG_BASE64,
									encoding: 'base64'
								}
							],
							violations: [],
							recommendedFixes: []
						}
					}),
					{ status: 200, statusText: 'OK' }
				);
			})
		);

		await studio.handleGeneratePage();

		expect(studio.spec.pageSize).toBe('A4');
		expect(packageSpy).toHaveBeenCalled();
		for (const call of packageSpy.mock.calls) {
			expect(call[0].pageSize).toBe('US_Letter');
		}
	});

	it('describes those downloads as the paper they were made on, not the live setting', async () => {
		// The other half: packaging for the right paper and then labelling the row from the live spec
		// presented a US Letter PDF as "A4 — ready to print".
		const { studio } = await savingStudio();
		vi.spyOn(outputPackagingAdapter, 'package').mockResolvedValue({
			ok: true,
			value: {
				files: [
					{ filename: 'page.pdf', mimeType: 'application/pdf', dataBase64: 'cGRm' }
				]
			}
		});

		studio.pageSize = 'US_Letter';
		studio.textOutput = { ...DEFAULT_STUDIO_TEXT_OUTPUT };
		vi.stubGlobal(
			'fetch',
			vi.fn().mockImplementation(async () => {
				studio.pageSize = 'A4';
				await studio.syncSpecFromCurrentText('setting');
				return new Response(
					JSON.stringify({
						ok: true,
						value: {
							prompt: 'the prompt this page was made with',
							templateVersion: 'v2',
							images: [
								{
									id: 'image-1',
									format: 'png',
									mimeType: 'image/png',
									data: PAGE_STYLE_PNG_BASE64,
									encoding: 'base64'
								}
							],
							violations: [],
							recommendedFixes: []
						}
					}),
					{ status: 200, statusText: 'OK' }
				);
			})
		);

		await studio.handleGeneratePage();

		const printed = studio.pageExports.filter((item) => item.kind === 'print');
		expect(printed.length).toBeGreaterThan(0);
		for (const item of printed) {
			expect(item.purpose).toContain('US Letter');
			expect(item.purpose).not.toContain('A4');
		}
	});

	it('does not send a draft’s wig on a generation the reader cannot see it in', async () => {
		// A restored draft used to put its stored wig into `restoredStyleWig`, which has no control
		// of its own — the carousel reads `selectedWig`, which stays null. `handleGeneratePage` reads
		// that fallback before the reset clears it, so a refresh could spend a paid generation on a
		// wig chosen invisibly.
		const { studio } = await initFromStoredDraft({
			...styleSelection,
			wig: { name: 'Honey Drip', style: 'body wave' }
		});

		// Nothing on screen names a wig.
		expect(studio.selectedWig).toBeNull();

		await generatePage(studio);

		const fetchMock = globalThis.fetch as unknown as { mock: { calls: unknown[][] } };
		const body = JSON.parse((fetchMock.mock.calls[0][1] as { body: string }).body) as {
			styleHint: string;
		};
		expect(body.styleHint).not.toContain('Honey Drip');
	});

	it('still sends a reopened page’s own wig, which is on the paper', async () => {
		// The other half of the same rule: a vault record's wig belongs to a page that exists, so
		// regenerating it must keep that wig rather than reach for the carousel.
		const studio = registerInitialized(new StudioState());
		await studio.init();

		await studio.loadCreation(
			makePicturedCreation({
				styleSelection: { ...styleSelection, wig: { name: 'Honey Drip', style: 'body wave' } }
			})
		);
		await generatePage(studio);

		const fetchMock = globalThis.fetch as unknown as { mock: { calls: unknown[][] } };
		const body = JSON.parse((fetchMock.mock.calls[0][1] as { body: string }).body) as {
			styleHint: string;
		};
		expect(body.styleHint).toContain('Honey Drip');
	});

	it('files a page saved before any generation under the controls that authored it', async () => {
		// The fallback the snapshot leaves in place. Nothing was generated, so there is no artifact
		// for the controls to disagree with — they *are* this page's paper.
		const { studio, saveSpy } = await savingStudio();

		studio.textOutput = { ...DEFAULT_STUDIO_TEXT_OUTPUT };
		studio.pageSize = 'A4';
		await studio.syncSpecFromCurrentText('setting');
		await studio.saveToVault();

		expect(saveSpy.mock.calls[0][0].record.intent.pageSize).toBe('A4');
	});

	it('stops the Glitter checkbox restyling a page that is already on the paper', async () => {
		// The preview draws its sparkle overlay from this. Bound to the live checkbox, it made the
		// panel's own promise — a finished page keeps the look it was made with — false on screen.
		const studio = registerInitialized(new StudioState());
		await studio.init();

		// With no page on the paper the overlay previews the setting, which is the one moment it is
		// honest for it to follow the checkbox.
		expect(studio.pageGlitter).toBe(false);
		studio.glitter = true;
		expect(studio.pageGlitter).toBe(true);

		studio.glitter = false;
		await generatePage(studio);
		expect(studio.pageGlitter).toBe(false);

		studio.glitter = true;
		expect(studio.pageGlitter).toBe(false);
	});

	it('shows no glitter over a page whose style is not on file', async () => {
		// The live checkbox over somebody else's picture is a claim about it, and the panel is
		// already telling the reader that claim cannot be made.
		const studio = registerInitialized(new StudioState());
		await studio.init();
		studio.glitter = true;

		await studio.loadCreation(makePicturedCreation());

		expect(studio.styleSelectionUnknown).toBe(true);
		expect(studio.pageGlitter).toBe(false);
	});

	it('gives the page back its own glitter when it is on file', async () => {
		const studio = registerInitialized(new StudioState());
		await studio.init();
		studio.glitter = false;

		await studio.loadCreation(makePicturedCreation({ styleSelection }));

		expect(studio.pageGlitter).toBe(true);
	});

	it('reports a check that ran and failed beside the controls, not only in the trace', async () => {
		// `validateSpec` resolves with `{ ok: false, issues }` for an ordinary contract failure, and
		// `applyTextToSpec` dropped that boolean — so the common failure reached the reader only in
		// System Trace, the panel this run took a settings failure out of. `settingsError` covers
		// the other case, a check that could not be run at all.
		const studio = registerInitialized(new StudioState());
		await studio.init();
		vi.spyOn(specValidationAdapter, 'validate').mockResolvedValue({
			ok: false,
			issues: [{ code: 'title_too_long', field: 'title', message: 'Title is too long.' }]
		});

		await studio.syncSpecFromCurrentText('setting');

		expect(studio.settingsIssues).toEqual(['Title is too long.']);
		expect(studio.settingsError).toBe('');
	});

	it('clears the reported issues once the next change passes its check', async () => {
		const studio = registerInitialized(new StudioState());
		await studio.init();
		studio.settingsIssues = ['something old'];

		await studio.syncSpecFromCurrentText('setting');

		expect(studio.settingsIssues).toEqual([]);
	});

	it('does not park another panel’s findings under Page Controls', async () => {
		// `validationIssues` is written by every path that validates — a generation, a reopen. Only
		// a change made from this panel belongs in the panel's own error region, and the report of a
		// change to the page being replaced does not outlive that page.
		const studio = registerInitialized(new StudioState());
		await studio.init();
		vi.spyOn(specValidationAdapter, 'validate').mockResolvedValue({
			ok: false,
			issues: [{ code: 'title_too_long', field: 'title', message: 'Title is too long.' }]
		});

		// The panel genuinely reports a complaint about the page that is about to be replaced,
		// rather than the test assigning one. `settingsIssues` is derived now, so a forged value is
		// no longer even expressible — which is the point of the derivation, and means this test
		// reaches the state the way the reader does.
		await studio.syncSpecFromCurrentText('setting');
		expect(studio.settingsIssues).toEqual(['Title is too long.']);

		await studio.loadCreation(makeStyledCreation({ styleSelection }));

		expect(studio.validationIssues).toHaveLength(1);
		expect(studio.settingsIssues).toEqual([]);
		expect(studio.settingsError).toBe('');
	});

	it('stops reporting a settings failure the reader has since fixed', async () => {
		// The panel's report was a copy taken at one moment, and a copy cannot follow its source. An
		// over-long dedication found by a Page Controls change stayed printed under the controls
		// after the reader went and fixed the dedication — the check now passes, `validationIssues`
		// is empty, and the panel was still insisting the page failed it. That is this run's own
		// defect inside this run's own reporting.
		const studio = registerInitialized(new StudioState());
		await studio.init();

		studio.handleDedicationInput('D'.repeat(MAX_DEDICATION_LENGTH + 1));
		await vi.waitFor(() => expect(studio.validationIssues.length).toBeGreaterThan(0));

		// A Page Control moves, and the panel correctly says the page does not pass its check.
		studio.pageSize = 'A4';
		await studio.syncSpecFromCurrentText('setting');
		expect(studio.settingsIssues.length).toBeGreaterThan(0);

		// The reader fixes the thing it complained about, somewhere else entirely.
		studio.handleDedicationInput('For Meechie');
		await vi.waitFor(() => expect(studio.validationIssues).toEqual([]));

		expect(studio.settingsIssues).toEqual([]);
	});

	it('stops saying a control change could not be checked once a check has run', async () => {
		// `settingsError` is the other half of the panel's report, and it goes stale the same way.
		// It says "that change was not *checked*", which stops being true the moment something else
		// checks the spec — and only the next Page Controls change cleared it, so the sentence could
		// outlive its own subject on a page that had since been validated twice.
		//
		// Found by mutation rather than by review: dropping the clear left the whole suite green,
		// which is the same as not having written it.
		const studio = registerInitialized(new StudioState());
		await studio.init();
		const validate = vi
			.spyOn(specValidationAdapter, 'validate')
			.mockRejectedValue(new Error('spec rebuild exploded'));

		studio.pageSize = 'A4';
		await studio.syncSpecFromCurrentText('setting');
		expect(studio.settingsError).toBe('spec rebuild exploded');

		// The seam recovers, and the reader's next edit gets a real answer about the spec.
		validate.mockRestore();
		studio.handleDedicationInput('For Meechie');
		await vi.waitFor(() => expect(studio.settingsError).toBe(''));
	});

	it('does not adopt a failure the reader caused somewhere else after a control passed', async () => {
		// The other half of deriving the report, and the half that keeps the derivation from
		// undoing an earlier fix. `settingsIssues` follows `validationIssues` now, so without a rule
		// saying when the panel stops answering, a control change that *passed* would leave the
		// panel wired to the live check — and the next failure from anywhere else, an over-long
		// dedication typed into a different box, would print itself under a row of controls the
		// reader had not touched. That is precisely the misattribution this run already removed
		// once.
		//
		// So `validateSpec` drops the claim whenever any check begins, and the panel's handler takes
		// it back after its own rebuild returns.
		const studio = registerInitialized(new StudioState());
		await studio.init();

		// A Page Control moves and the page passes, so the panel is answering and has nothing to say.
		studio.pageSize = 'A4';
		await studio.syncSpecFromCurrentText('setting');
		expect(studio.settingsIssues).toEqual([]);

		// The reader breaks the page from the dedication box instead.
		studio.handleDedicationInput('D'.repeat(MAX_DEDICATION_LENGTH + 1));
		await vi.waitFor(() => expect(studio.validationIssues.length).toBeGreaterThan(0));

		// Reported where it happened, not under the controls.
		expect(studio.settingsIssues).toEqual([]);
	});

	it('lets the reader give a style-less restored page a style of its own', async () => {
		// A review's finding against my own decline of it, and the decline was wrong. "Never invent
		// provenance" had become "never record it": a draft written before styles were stored could
		// never acquire one, so every autosave wrote `undefined` and every refresh threw away the
		// theme the reader had just picked. Permanently, on a page with no picture whose look is
		// entirely that choice — worse than the over-report it was protecting against.
		const draftSpy = vi.spyOn(creationStoreAdapter, 'saveDraft');
		const studio = await initFromDraft({
			updatedAtISO: '2026-09-01T00:00:00.000Z',
			intent: { ...buildSeedSpec(DEFAULT_STUDIO_TEXT_OUTPUT), title: 'A LEGACY DRAFT' }
		});
		expect(studio.styleSelectionUnknown).toBe(true);

		// The reader picks a theme. There is no picture, so nothing on the paper contradicts them.
		draftSpy.mockClear();
		studio.selectedThemeId = 'receipts';
		await studio.syncSpecFromCurrentText('theme');
		await vi.waitFor(() => expect(draftSpy).toHaveBeenCalled());

		// The notice goes, because the answer is now known.
		expect(studio.styleSelectionUnknown).toBe(false);
		// And the choice reaches the draft, so the next refresh keeps it.
		expect(draftSpy.mock.calls.at(-1)?.[0].draft.styleSelection?.themeId).toBe('receipts');
	});

	it('still refuses the controls as provenance for a restored picture, however deliberate', async () => {
		// The other side of the rule above, and the reason it is a comparison rather than "the panel
		// fired". A restored page that HAS a picture cannot be re-authored from the controls: the
		// image and the prompt came from choices nobody wrote down, and moving a theme afterwards
		// does not make it the theme that drew them. The reader's route to authoring this page is to
		// make it again.
		const { studio, saveSpy } = await savingStudio();
		await studio.loadCreation(makePicturedCreation());
		expect(studio.styleSelectionUnknown).toBe(true);

		studio.selectedThemeId = 'receipts';
		await studio.syncSpecFromCurrentText('theme');

		expect(studio.styleSelectionUnknown).toBe(true);
		await studio.saveToVault();
		expect(saveSpy.mock.calls[0][0].record.styleSelection).toBeUndefined();
	});

	it('does not read a moved page size as a style the reader chose', async () => {
		// Page size and border reach the studio through the same handler as the theme and are not
		// style — they live in the intent. So the supersede is a comparison against the controls as
		// restored, not "the settings panel fired": otherwise moving the paper size would write the
		// untouched default theme down as a deliberate choice, which is the invention the whole
		// field exists to prevent.
		const draftSpy = vi.spyOn(creationStoreAdapter, 'saveDraft');
		const studio = await initFromDraft({
			updatedAtISO: '2026-09-01T00:00:00.000Z',
			intent: { ...buildSeedSpec(DEFAULT_STUDIO_TEXT_OUTPUT), title: 'A LEGACY DRAFT' }
		});

		draftSpy.mockClear();
		studio.pageSize = 'A4';
		await studio.syncSpecFromCurrentText('setting');
		await vi.waitFor(() => expect(draftSpy).toHaveBeenCalled());

		expect(studio.styleSelectionUnknown).toBe(true);
		expect(draftSpy.mock.calls.at(-1)?.[0].draft.styleSelection).toBeUndefined();
		// The paper choice itself is saved, through the field that always carried it.
		expect(draftSpy.mock.calls.at(-1)?.[0].draft.intent.pageSize).toBe('A4');
	});

	it('does not treat a draft that stored no style as wearing the controls it comes back to', async () => {
		// The `loadCreation` rule, missing from the other restore path. Every draft written before
		// `styleSelection` existed has none, and leaving the flag false made the studio read whatever
		// the controls happened to say as that draft's own style — so the next autosave wrote those
		// values down beside a restored intent they did not author, and the refresh after that
		// applied them. Invented provenance in two steps, from a draft that recorded none.
		const draftSpy = vi.spyOn(creationStoreAdapter, 'saveDraft');
		const studio = await initFromDraft({
			updatedAtISO: '2026-09-01T00:00:00.000Z',
			intent: { ...buildSeedSpec(DEFAULT_STUDIO_TEXT_OUTPUT), title: 'A LEGACY DRAFT' }
		});

		expect(studio.styleSelectionUnknown).toBe(true);

		// And the autosave says so rather than filling the gap in.
		draftSpy.mockClear();
		studio.handleDedicationInput('For Meechie');
		await vi.waitFor(() => expect(draftSpy).toHaveBeenCalled());
		expect(draftSpy.mock.calls.at(-1)?.[0].draft.styleSelection).toBeUndefined();
	});
});
