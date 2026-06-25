// Purpose: Unit tests for runWigTryOnPipeline's internal abort guard.
// Why: Defense-in-depth — the route already checks checkWigTryOnAbort before calling in,
// but the pipeline must also fail fast for any other caller that skips that preflight.
// Info flow: Pipeline body+deps -> abort guard -> aborted response (no catalog/fetch/tryOn calls).
import { describe, expect, it, vi } from 'vitest';
import { runWigTryOnPipeline } from '../../src/lib/core/wig-try-on-pipeline';

const validBody = {
	selfieBase64: 'selfie-data',
	selfieMimeType: 'image/jpeg',
	wigId: 'wig-001'
};

describe('runWigTryOnPipeline abort guard', () => {
	it('returns WIG_TRY_ON_ABORTED before any catalog lookup or image fetch when the signal is already aborted', async () => {
		const controller = new AbortController();
		controller.abort();
		const getWigById = vi.fn();
		const fetchImpl = vi.fn();
		const tryOn = vi.fn();

		const result = await runWigTryOnPipeline(validBody, {
			fetchImpl,
			wigCatalogSeam: { listWigs: vi.fn(), getWigById },
			wigTryOnSeam: { tryOn },
			signal: controller.signal
		});

		expect(result.status).toBe(499);
		expect(result.body.ok).toBe(false);
		if (!result.body.ok) {
			expect(result.body.error.code).toBe('WIG_TRY_ON_ABORTED');
		}
		expect(getWigById).not.toHaveBeenCalled();
		expect(fetchImpl).not.toHaveBeenCalled();
		expect(tryOn).not.toHaveBeenCalled();
	});
});
