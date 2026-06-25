// Purpose: Unit tests for wig-try-on-pipeline error branches and MIME fallback.
// Why: The only prior coverage (tests/unit/api-wig-try-on.test.ts) exercised the route's
//      input-validation guards and a single happy path; every seam-error branch and the
//      MIME allowlist fallback in runWigTryOnPipeline were untested.
// Info flow: Pipeline inputs + mocked seams/fetch -> runWigTryOnPipeline -> verified status/body.
import { describe, expect, it, vi } from 'vitest';
import { runWigTryOnPipeline } from '../../src/lib/core/wig-try-on-pipeline';
import type { PipelineDeps } from '../../src/lib/core/wig-try-on-pipeline';
import type { Wig } from '../../src/lib/seams/wig-catalog-seam/contract';

const wig: Wig = {
	id: 'wig-001',
	name: 'Sleek Straight Goddess',
	brand: 'Beautyforever',
	affiliateProgram: 'beautyforever',
	affiliateUrl: 'https://example.com/wig',
	imageUrl: 'https://example.com/wig.png',
	priceUsd: 89.99,
	style: 'Straight Lace Front',
	hairType: 'human',
	length: 'medium',
	color: 'Natural Black',
	colorFamily: 'black',
	tags: ['sleek']
};

const validBody = {
	selfieBase64: 'selfie-data',
	selfieMimeType: 'image/jpeg',
	wigId: wig.id
};

const okImageResponse = (contentType: string | null = 'image/png') =>
	new Response(new Uint8Array([1, 2, 3]), {
		status: 200,
		headers: contentType ? { 'Content-Type': contentType } : undefined
	});

const makeDeps = (overrides: Partial<PipelineDeps> = {}): PipelineDeps => ({
	fetchImpl: vi.fn(async () => okImageResponse()),
	wigCatalogSeam: {
		listWigs: vi.fn(async () => ({ ok: true as const, value: [wig] })),
		getWigById: vi.fn(async () => ({ ok: true as const, value: wig }))
	},
	wigTryOnSeam: {
		tryOn: vi.fn(async () => ({
			ok: true as const,
			value: {
				portraitBase64: 'portrait-data',
				portraitMimeType: 'image/png',
				timingMs: 10
			}
		}))
	},
	...overrides
});

describe('runWigTryOnPipeline', () => {
	it('returns 404 with WIG_NOT_FOUND when the catalog seam cannot find the wig', async () => {
		const deps = makeDeps({
			wigCatalogSeam: {
				listWigs: vi.fn(),
				getWigById: vi.fn(async () => ({
					ok: false as const,
					error: {
						code: 'WIG_NOT_FOUND' as const,
						message: 'No such wig.',
						details: { id: wig.id }
					}
				}))
			}
		});

		const result = await runWigTryOnPipeline(validBody, deps);

		expect(result.status).toBe(404);
		expect(result.body).toEqual({
			ok: false,
			error: { code: 'WIG_NOT_FOUND', message: 'No such wig.' }
		});
	});

	it('returns 500 for non-not-found catalog errors', async () => {
		const deps = makeDeps({
			wigCatalogSeam: {
				listWigs: vi.fn(),
				getWigById: vi.fn(async () => ({
					ok: false as const,
					error: {
						code: 'WIG_CATALOG_LOAD_FAILED' as const,
						message: 'Catalog unavailable.'
					}
				}))
			}
		});

		const result = await runWigTryOnPipeline(validBody, deps);

		expect(result.status).toBe(500);
		expect(result.body).toMatchObject({
			ok: false,
			error: { code: 'WIG_CATALOG_LOAD_FAILED' }
		});
	});

	it('returns 502 WIG_IMAGE_FETCH_FAILED when the wig image response is not ok', async () => {
		const deps = makeDeps({
			fetchImpl: vi.fn(async () => new Response(null, { status: 404 }))
		});

		const result = await runWigTryOnPipeline(validBody, deps);

		expect(result.status).toBe(502);
		expect(result.body).toMatchObject({
			ok: false,
			error: {
				code: 'WIG_IMAGE_FETCH_FAILED',
				message: expect.stringContaining(wig.name)
			}
		});
	});

	it('returns 502 WIG_IMAGE_FETCH_FAILED when fetching the wig image throws', async () => {
		const deps = makeDeps({
			fetchImpl: vi.fn(async () => {
				throw new Error('network down');
			})
		});

		const result = await runWigTryOnPipeline(validBody, deps);

		expect(result.status).toBe(502);
		expect(result.body).toMatchObject({
			ok: false,
			error: { code: 'WIG_IMAGE_FETCH_FAILED' }
		});
	});

	it('falls back to image/jpeg when the fetched wig image has a disallowed MIME type', async () => {
		const tryOn = vi.fn(async () => ({
			ok: true as const,
			value: {
				portraitBase64: 'portrait-data',
				portraitMimeType: 'image/png',
				timingMs: 10
			}
		}));
		const deps = makeDeps({
			fetchImpl: vi.fn(async () => okImageResponse('application/octet-stream')),
			wigTryOnSeam: { tryOn }
		});

		const result = await runWigTryOnPipeline(validBody, deps);

		expect(result.status).toBe(200);
		expect(tryOn).toHaveBeenCalledWith(
			expect.objectContaining({ wigImageMimeType: 'image/jpeg' })
		);
	});

	it('returns 400 when the try-on seam reports a validation error', async () => {
		const deps = makeDeps({
			wigTryOnSeam: {
				tryOn: vi.fn(async () => ({
					ok: false as const,
					error: {
						code: 'WIG_TRY_ON_VALIDATION_ERROR' as const,
						message: 'Selfie image is invalid.'
					}
				}))
			}
		});

		const result = await runWigTryOnPipeline(validBody, deps);

		expect(result.status).toBe(400);
		expect(result.body).toMatchObject({
			ok: false,
			error: { code: 'WIG_TRY_ON_VALIDATION_ERROR' }
		});
	});

	it('returns 502 when the try-on seam reports a provider/network error', async () => {
		const deps = makeDeps({
			wigTryOnSeam: {
				tryOn: vi.fn(async () => ({
					ok: false as const,
					error: {
						code: 'WIG_TRY_ON_HTTP_ERROR' as const,
						message: 'Gemini returned 503.'
					}
				}))
			}
		});

		const result = await runWigTryOnPipeline(validBody, deps);

		expect(result.status).toBe(502);
		expect(result.body).toMatchObject({
			ok: false,
			error: { code: 'WIG_TRY_ON_HTTP_ERROR' }
		});
	});

	it('returns 500 WIG_TRY_ON_OUTPUT_INVALID when the seam result fails the output schema', async () => {
		const deps = makeDeps({
			wigTryOnSeam: {
				tryOn: vi.fn(async () => ({
					ok: true as const,
					value: {
						portraitBase64: '',
						portraitMimeType: 'image/png',
						timingMs: 10
					}
				}))
			}
		});

		const result = await runWigTryOnPipeline(validBody, deps);

		expect(result.status).toBe(500);
		expect(result.body).toMatchObject({
			ok: false,
			error: { code: 'WIG_TRY_ON_OUTPUT_INVALID' }
		});
	});

	it('returns 200 with the portrait payload on the full success path', async () => {
		const deps = makeDeps();

		const result = await runWigTryOnPipeline(validBody, deps);

		expect(result.status).toBe(200);
		expect(result.body).toEqual({
			ok: true,
			value: { portraitBase64: 'portrait-data', portraitMimeType: 'image/png' }
		});
	});
});
