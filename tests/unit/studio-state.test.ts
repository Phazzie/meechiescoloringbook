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
		studio.packagedFiles = [
			{ filename: 'page.pdf', mimeType: 'application/pdf', dataBase64: 'abc' }
		];
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
		studio.packagedFiles = [
			{ filename: 'page.pdf', mimeType: 'application/pdf', dataBase64: 'abc' }
		];
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
		const packageSpy = vi.spyOn(outputPackagingAdapter, 'package').mockResolvedValue({
			ok: true,
			value: {
				files: [
					{ filename: 'saved.pdf', mimeType: 'application/pdf', dataBase64: 'cGRm' }
				]
			}
		});

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
		// Download PDF works again on a reopened page instead of sitting disabled.
		expect(packageSpy).toHaveBeenCalledOnce();
		expect(studio.packagedFiles).toEqual([
			{ filename: 'saved.pdf', mimeType: 'application/pdf', dataBase64: 'cGRm' }
		]);
	});

	it('discards a stale packaging result when another page is opened first', async () => {
		const studio = new StudioState();
		let releaseFirstPackaging: (() => void) | null = null;
		vi.spyOn(outputPackagingAdapter, 'package').mockImplementation(async () => {
			if (!releaseFirstPackaging) {
				await new Promise<void>((resolve) => {
					releaseFirstPackaging = resolve;
				});
				return {
					ok: true,
					value: {
						files: [
							{ filename: 'first.pdf', mimeType: 'application/pdf', dataBase64: 'Zmlyc3Q=' }
						]
					}
				};
			}
			return {
				ok: true,
				value: {
					files: [
						{ filename: 'second.pdf', mimeType: 'application/pdf', dataBase64: 'c2Vjb25k' }
					]
				}
			};
		});

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
		expect(studio.packagedFiles).toEqual([
			{ filename: 'second.pdf', mimeType: 'application/pdf', dataBase64: 'c2Vjb25k' }
		]);

		// The late first result must not replace what is now on screen.
		releaseFirstPackaging!();
		await firstLoad;

		expect(studio.packagedFiles).toEqual([
			{ filename: 'second.pdf', mimeType: 'application/pdf', dataBase64: 'c2Vjb25k' }
		]);
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
		expect(studio.generationError).toBe('');
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
		studio.selectedWigId = 'wig-1';
		studio.selfieBase64 = 'selfie-bytes';
		studio.images = [
			{ id: 'image-1', format: 'png', mimeType: 'image/png', data: 'abc', encoding: 'base64' }
		];
		studio.packagedFiles = [
			{ filename: 'page.pdf', mimeType: 'application/pdf', dataBase64: 'abc' }
		];
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
		studio.selectedWigId = SAMPLE_WIG.id;
		studio.selectedWig = SAMPLE_WIG;
		studio.tryOnPortraitUrl = 'data:image/png;base64,ZmFrZQ==';
		studio.images = [
			{ id: 'image-1', format: 'png', mimeType: 'image/png', data: 'abc', encoding: 'base64' }
		];
		studio.packagedFiles = [
			{ filename: 'page.pdf', mimeType: 'application/pdf', dataBase64: 'abc' }
		];

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
		studio.tryOnPortraitUrl = 'data:image/jpeg;base64,/9j/4AAQ';

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
		studio.tryOnPortraitUrl = 'data:image/webp;base64,d2VicA==';

		await studio.handleGenerateTryOnPage();

		expect(packageSpy).toHaveBeenCalledOnce();
		const input = packageSpy.mock.calls[0][0];
		expect(input.images[0]).toMatchObject({
			format: 'webp',
			mimeType: 'image/webp',
			data: 'd2VicA==',
			encoding: 'base64'
		});
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
});
