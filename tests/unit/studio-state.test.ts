// Purpose: Unit tests for StudioState page orchestration edge cases.
// Why: Keep extracted studio state behavior aligned with component callback contracts.
// Info flow: StudioState actions -> spec/images/package calls -> assertions.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { creationStoreAdapter } from '../../src/lib/adapters/creation-store.adapter';
import { outputPackagingAdapter } from '../../src/lib/adapters/output-packaging.adapter';
import { sessionAdapter } from '../../src/lib/adapters/session.adapter';
import { StudioState } from '../../src/routes/studio-state.svelte';

afterEach(() => {
	vi.restoreAllMocks();
	vi.useRealTimers();
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

	it('still allows draft saves after init fails to load the initial draft', async () => {
		vi.spyOn(sessionAdapter, 'getSession').mockResolvedValue({
			ok: false,
			error: { code: 'SESSION_ERROR', message: 'no session' }
		});
		vi.spyOn(creationStoreAdapter, 'getDraft').mockResolvedValue({
			ok: false,
			error: { code: 'DRAFT_READ_FAILED', message: 'corrupt draft' }
		});
		const saveDraftSpy = vi.spyOn(creationStoreAdapter, 'saveDraft');

		vi.useFakeTimers();
		const studio = new StudioState();
		await studio.init();

		saveDraftSpy.mockResolvedValue({
			ok: true,
			value: { updatedAtISO: new Date().toISOString(), intent: studio.spec }
		});

		studio.handleDedicationInput('Edited after failed load');
		await vi.runAllTimersAsync();

		expect(saveDraftSpy).toHaveBeenCalled();
	});

	it('still allows draft saves after init throws instead of resolving a failed Result', async () => {
		vi.spyOn(sessionAdapter, 'getSession').mockRejectedValue(new Error('network unreachable'));
		vi.spyOn(creationStoreAdapter, 'getDraft').mockResolvedValue({
			ok: false,
			error: { code: 'DRAFT_READ_FAILED', message: 'corrupt draft' }
		});
		const saveDraftSpy = vi.spyOn(creationStoreAdapter, 'saveDraft');

		vi.useFakeTimers();
		const studio = new StudioState();
		await expect(studio.init()).rejects.toThrow('network unreachable');

		saveDraftSpy.mockResolvedValue({
			ok: true,
			value: { updatedAtISO: new Date().toISOString(), intent: studio.spec }
		});

		studio.handleDedicationInput('Edited after thrown init error');
		await vi.runAllTimersAsync();

		expect(saveDraftSpy).toHaveBeenCalled();
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
