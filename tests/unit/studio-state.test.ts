// Purpose: Unit tests for StudioState page orchestration edge cases.
// Why: Keep extracted studio state behavior aligned with component callback contracts.
// Info flow: StudioState actions -> spec/images/package calls -> assertions.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { outputPackagingAdapter } from '../../src/lib/adapters/output-packaging.adapter';
import { StudioState } from '../../src/routes/studio-state.svelte';

afterEach(() => {
	vi.restoreAllMocks();
});

describe('StudioState', () => {
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

	it('clears stale errors, images, and wig try-on state when loading a saved creation', async () => {
		const studio = new StudioState();
		studio.generationError = 'Previous generation failed.';
		studio.textError = 'Previous text error.';
		studio.copyStatus = 'Quote copied.';
		studio.vaultStatus = 'Saved to the quote vault.';
		studio.images = [
			{ id: 'image-1', format: 'png', mimeType: 'image/png', data: 'stale', encoding: 'base64' }
		];
		studio.selectedWigId = 'wig-1';
		studio.selectedWig = { id: 'wig-1' } as unknown as typeof studio.selectedWig;
		studio.selfieBase64 = 'stale-selfie';
		studio.tryOnPortraitUrl = 'data:image/png;base64,stale';
		studio.tryOnError = 'Previous try-on error.';

		await studio.loadCreation({
			id: 'creation-1',
			createdAtISO: new Date(0).toISOString(),
			intent: studio.spec,
			assembledPrompt: 'A saved prompt',
			owner: { kind: 'anonymous', sessionId: 'session-1' }
		});

		expect(studio.generationError).toBe('');
		expect(studio.textError).toBe('');
		expect(studio.copyStatus).toBe('');
		expect(studio.vaultStatus).toBe('');
		expect(studio.images).toEqual([]);
		expect(studio.selectedWigId).toBeNull();
		expect(studio.selectedWig).toBeNull();
		expect(studio.selfieBase64).toBe('');
		expect(studio.tryOnPortraitUrl).toBe('');
		expect(studio.tryOnError).toBe('');
	});
});
