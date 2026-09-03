// Purpose: Unit tests for StudioState page orchestration edge cases.
// Why: Keep extracted studio state behavior aligned with component callback contracts.
// Info flow: StudioState actions -> spec/images/package calls -> assertions.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { outputPackagingAdapter } from '../../src/lib/adapters/output-packaging.adapter';
import {
	DEFAULT_STUDIO_TEXT_OUTPUT,
	buildColoringPageSpecFromMeechieText
} from '../../src/lib/core/meechie-studio';
import { StudioState } from '../../src/routes/studio-state.svelte';
import type { CreationRecord, DraftRecord } from '../../contracts/creation-store.contract';
import type { MeechieStudioTextOutput } from '../../contracts/meechie-studio-text.contract';

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

	it('clears a previously generated page when a saved creation is loaded', async () => {
		const studio = new StudioState();
		studio.images = [
			{ id: 'image-1', format: 'png', mimeType: 'image/png', data: 'abc', encoding: 'base64' }
		];
		studio.packagedFiles = [
			{ filename: 'page.pdf', mimeType: 'application/pdf', dataBase64: 'abc' }
		];
		studio.assembledPrompt = 'stale assembled prompt';
		studio.generationError = 'stale error';

		const creation: CreationRecord = {
			id: 'creation-1',
			createdAtISO: '2026-09-03T00:00:00.000Z',
			intent: buildSeedSpec(DEFAULT_STUDIO_TEXT_OUTPUT),
			assembledPrompt: 'a different creation entirely',
			owner: { kind: 'anonymous', sessionId: 'session-1' }
		};

		await studio.loadCreation(creation);

		expect(studio.images).toEqual([]);
		expect(studio.packagedFiles).toEqual([]);
		expect(studio.assembledPrompt).toBe('');
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
