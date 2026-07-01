// Purpose: Unit tests for runWigTryOnPipeline's abort guard and precomputed wig handling.
// Why: Defense-in-depth for callers that skip route preflight, plus regression coverage for
// avoiding redundant catalog lookups and re-checking cancellation after the awaited preflight.
// Info flow: Pipeline body+deps -> abort/precomputed-wig branch -> early response or catalog/fetch/tryOn calls.
import { describe, expect, it, vi } from 'vitest';
import { runWigTryOnPipeline } from '../../src/lib/core/wig-try-on-pipeline';

const validBody = {
	selfieBase64: 'selfie-data',
	selfieMimeType: 'image/jpeg',
	wigId: 'wig-001'
};

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

	it('returns WIG_TRY_ON_ABORTED if the signal aborts during the awaited catalog preflight, without fetching the image', async () => {
		const controller = new AbortController();
		const getWigById = vi.fn(async () => {
			controller.abort();
			return { ok: true as const, value: wig };
		});
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
		expect(fetchImpl).not.toHaveBeenCalled();
		expect(tryOn).not.toHaveBeenCalled();
	});
});

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

	it('falls back to catalog lookup when precomputedWig.id does not match request wigId', async () => {
		const staleWig = { ...wig, id: 'wig-999' };
		const getWigById = vi.fn(async () => ({ ok: true as const, value: wig }));
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
			precomputedWig: staleWig
		});

		expect(result.status).toBe(200);
		expect(getWigById).toHaveBeenCalledWith(validBody.wigId);
	});
});
