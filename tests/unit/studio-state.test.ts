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
});
