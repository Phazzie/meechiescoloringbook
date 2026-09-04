// Purpose: Unit tests for StudioState page orchestration edge cases.
// Why: Keep extracted studio state behavior aligned with component callback contracts.
// Info flow: StudioState actions -> spec/images/package calls -> assertions.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { creationStoreAdapter } from '../../src/lib/adapters/creation-store.adapter';
import { outputPackagingAdapter } from '../../src/lib/adapters/output-packaging.adapter';
import { sessionAdapter } from '../../src/lib/adapters/session.adapter';
import {
	DEFAULT_STUDIO_TEXT_OUTPUT,
	buildColoringPageSpecFromMeechieText
} from '../../src/lib/core/meechie-studio';
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

const initFromDraft = async (draft: DraftRecord): Promise<StudioState> => {
	localStorage.setItem('cb_drafts_v1', JSON.stringify(draft));
	const studio = new StudioState();
	await studio.init();
	return studio;
};

afterEach(() => {
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
	const initVault = async (records: CreationRecord[]): Promise<StudioState> => {
		const sessionSpy = vi.spyOn(sessionAdapter, 'getSession').mockResolvedValue({
			ok: true,
			value: { sessionId: SESSION_ID }
		});
		for (const record of records) {
			await creationStoreAdapter.saveCreation({ record });
		}
		const studio = new StudioState();
		await studio.init();
		expect(sessionSpy).toHaveBeenCalled();
		return studio;
	};

	afterEach(() => {
		vi.restoreAllMocks();
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
				createdAtISO: `2026-08-${String((index % 28) + 1).padStart(2, '0')}T00:00:00.000Z`
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
});
