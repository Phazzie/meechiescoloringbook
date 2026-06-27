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

const wig = {
	id: 'wig-001',
	name: 'Sleek Straight Goddess',
	brand: 'Beautyforever',
	affiliateProgram: 'beautyforever' as const,
	affiliateUrl: 'https://example.com/wig',
	imageUrl: 'https://example.com/wig.png',
	priceUsd: 89.99,
	style: 'Straight Lace Front',
	hairType: 'human' as const,
	length: 'medium' as const,
	color: 'Natural Black',
	colorFamily: 'black' as const,
	tags: ['sleek']
};

describe('runWigTryOnPipeline precomputedWig', () => {
	it('skips getWigById when precomputedWig is supplied', async () => {
		const getWigById = vi.fn();
		const fetchImpl = vi.fn(async () =>
			new Response(new Uint8Array([1, 2, 3]), {
				status: 200,
				headers: { 'Content-Type': 'image/png' }
			})
		);
		const tryOn = vi.fn(async () => ({
			ok: true as const,
			value: { portraitBase64: 'portrait-data', portraitMimeType: 'image/png', timingMs: 10 }
		}));

		const result = await runWigTryOnPipeline(validBody, {
			fetchImpl,
			wigCatalogSeam: { listWigs: vi.fn(), getWigById },
			wigTryOnSeam: { tryOn },
			precomputedWig: wig
		});

		expect(result.status).toBe(200);
		expect(getWigById).not.toHaveBeenCalled();
		expect(fetchImpl).toHaveBeenCalledWith(wig.imageUrl);
	});
});
