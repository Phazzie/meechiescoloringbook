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
import type { DraftRecord } from '../../contracts/creation-store.contract';
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
		['pre-#232 I DON\'T ACT seed', LEGACY_STUDIO_TEXT_OUTPUT]
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
