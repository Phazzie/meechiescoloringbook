// Purpose: Unit tests for wig-try-on-pipeline abort handling and image fetch failures.
// Why: Caller aborts must surface as 499, not be misclassified as a generic 502 fetch failure.
// Info flow: Pipeline inputs + mocked seams/fetch -> pipeline function -> verified responses.
import { describe, expect, it, vi } from 'vitest';
import { runWigTryOnPipeline } from '../../src/lib/core/wig-try-on-pipeline';
import type { Wig, WigCatalogSeam } from '../../src/lib/seams/wig-catalog-seam/contract';
import type { WigTryOnSeam } from '../../src/lib/seams/wig-try-on-seam/contract';

const wig: Wig = {
	id: 'wig-1',
	name: 'Bouncy Bob',
	brand: 'Acme',
	affiliateProgram: 'beautyforever',
	affiliateUrl: 'https://example.com/wig-1',
	imageUrl: 'https://example.com/wig-1.jpg',
	priceUsd: 49.99,
	style: 'bob',
	hairType: 'synthetic',
	length: 'medium',
	color: 'black',
	colorFamily: 'black',
	tags: []
};

const validBody = {
	selfieBase64: 'c2VsZmll',
	selfieMimeType: 'image/jpeg' as const,
	wigId: 'wig-1'
};

const buildDeps = (overrides: {
	fetchImpl?: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
	wigCatalogSeam?: WigCatalogSeam;
	wigTryOnSeam?: WigTryOnSeam;
	signal?: AbortSignal;
}) => ({
	fetchImpl:
		overrides.fetchImpl ??
		vi.fn(async () => new Response(new ArrayBuffer(4), { headers: { 'content-type': 'image/jpeg' } })),
	wigCatalogSeam:
		overrides.wigCatalogSeam ??
		({
			listWigs: vi.fn(async () => ({ ok: true as const, value: [wig] })),
			getWigById: vi.fn(async () => ({ ok: true as const, value: wig }))
		} satisfies WigCatalogSeam),
	wigTryOnSeam:
		overrides.wigTryOnSeam ??
		({
			tryOn: vi.fn(async () => ({
				ok: true as const,
				value: { portraitBase64: 'cG9ydHJhaXQ=', portraitMimeType: 'image/png', timingMs: 10 }
			}))
		} satisfies WigTryOnSeam),
	signal: overrides.signal
});

describe('wig-try-on-pipeline abort handling', () => {
	it('returns 499 before calling any seam when caller signal is already aborted', async () => {
		const controller = new AbortController();
		controller.abort();
		const deps = buildDeps({ signal: controller.signal });

		const result = await runWigTryOnPipeline(validBody, deps);

		expect(result.status).toBe(499);
		expect(result.body.ok).toBe(false);
		if (!result.body.ok) {
			expect(result.body.error.code).toBe('WIG_TRY_ON_ABORTED');
		}
		expect(deps.wigCatalogSeam.getWigById).not.toHaveBeenCalled();
	});

	it('returns 499 when the wig image fetch is aborted mid-flight', async () => {
		const controller = new AbortController();
		const fetchImpl = vi.fn(async () => {
			throw Object.assign(new Error('Operation aborted by caller.'), { name: 'AbortError' });
		});
		const deps = buildDeps({ fetchImpl, signal: controller.signal });

		const result = await runWigTryOnPipeline(validBody, deps);

		expect(result.status).toBe(499);
		expect(result.body.ok).toBe(false);
		if (!result.body.ok) {
			expect(result.body.error.code).toBe('WIG_TRY_ON_ABORTED');
		}
	});

	it('returns 502 WIG_IMAGE_FETCH_FAILED when the wig image fetch fails for a non-abort reason', async () => {
		const fetchImpl = vi.fn(async () => {
			throw new Error('socket hang up');
		});
		const deps = buildDeps({ fetchImpl });

		const result = await runWigTryOnPipeline(validBody, deps);

		expect(result.status).toBe(502);
		expect(result.body.ok).toBe(false);
		if (!result.body.ok) {
			expect(result.body.error.code).toBe('WIG_IMAGE_FETCH_FAILED');
		}
	});

	it('returns 502 WIG_IMAGE_FETCH_FAILED when the wig image response is not ok', async () => {
		const fetchImpl = vi.fn(async () => new Response(null, { status: 404 }));
		const deps = buildDeps({ fetchImpl });

		const result = await runWigTryOnPipeline(validBody, deps);

		expect(result.status).toBe(502);
		expect(result.body.ok).toBe(false);
		if (!result.body.ok) {
			expect(result.body.error.code).toBe('WIG_IMAGE_FETCH_FAILED');
		}
	});

	it('succeeds with a valid pipeline flow', async () => {
		const deps = buildDeps({});

		const result = await runWigTryOnPipeline(validBody, deps);

		expect(result.status).toBe(200);
		expect(result.body.ok).toBe(true);
		if (result.body.ok) {
			expect(result.body.value.portraitBase64).toBe('cG9ydHJhaXQ=');
		}
	});
});
