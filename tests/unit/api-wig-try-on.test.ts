// Purpose: Verify /api/wig-try-on rejects malformed JSON before seam instantiation.
// Why: Ensure the INVALID_JSON guard fires before any expensive seam creation occurs.
// Info flow: Raw request -> parseRequestBody -> INVALID_JSON response (no seam calls).
import { describe, expect, it, vi } from 'vitest';

vi.mock('$lib/adapters/app-config-seam/index', () => ({
	createAppConfigSeam: vi.fn()
}));
vi.mock('$lib/adapters/wig-catalog-seam/index', () => ({
	createWigCatalogSeam: vi.fn()
}));
vi.mock('$lib/adapters/wig-try-on-seam/index', () => ({
	createWigTryOnSeam: vi.fn()
}));

import { createAppConfigSeam } from '$lib/adapters/app-config-seam/index';
import { createWigCatalogSeam } from '$lib/adapters/wig-catalog-seam/index';
import { createWigTryOnSeam } from '$lib/adapters/wig-try-on-seam/index';
import * as rateLimiterModule from '$lib/server/rate-limiter';
import { POST } from '../../src/routes/api/wig-try-on/+server';

const buildRawEvent = (rawBody: string): Parameters<typeof POST>[0] =>
	({
		request: new Request('http://localhost/api/wig-try-on', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: rawBody
		}),
		fetch: vi.fn(),
		getClientAddress: () => '203.0.113.10'
	}) as unknown as Parameters<typeof POST>[0];

const buildEvent = (body: unknown): Parameters<typeof POST>[0] =>
	({
		request: new Request('http://localhost/api/wig-try-on', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(body)
		}),
		fetch: vi.fn(),
		getClientAddress: () => '203.0.113.10'
	}) as unknown as Parameters<typeof POST>[0];

const buildAbortedEvent = (body: unknown): Parameters<typeof POST>[0] => {
	const controller = new AbortController();
	controller.abort();
	return {
		request: new Request('http://localhost/api/wig-try-on', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(body),
			signal: controller.signal
		}),
		fetch: vi.fn(),
		getClientAddress: () => '203.0.113.10'
	} as unknown as Parameters<typeof POST>[0];
};

describe('/api/wig-try-on', () => {
	it('rejects an already-aborted request before any preflight checks or rate-limit consumption', async () => {
		vi.mocked(createAppConfigSeam).mockReset();
		vi.mocked(createWigCatalogSeam).mockReset();
		vi.mocked(createWigTryOnSeam).mockReset();

		const response = await POST(
			buildAbortedEvent({ selfieBase64: 'selfie-data', selfieMimeType: 'image/jpeg', wigId: 'wig-001' })
		);
		const payload = await response.json();

		expect(response.status).toBe(499);
		expect(payload.ok).toBe(false);
		expect(payload.error.code).toBe('WIG_TRY_ON_ABORTED');
		expect(createWigCatalogSeam).not.toHaveBeenCalled();
		expect(createAppConfigSeam).not.toHaveBeenCalled();
		expect(createWigTryOnSeam).not.toHaveBeenCalled();
	});

	it('does not consume rate-limit quota for already-aborted requests', async () => {
		vi.mocked(createAppConfigSeam).mockReset();
		vi.mocked(createWigCatalogSeam).mockReset();
		vi.mocked(createWigTryOnSeam).mockReset();

		for (let i = 0; i < 25; i += 1) {
			const response = await POST(
				buildAbortedEvent({ selfieBase64: 'selfie-data', selfieMimeType: 'image/jpeg', wigId: 'wig-001' })
			);
			expect(response.status).toBe(499);
			const payload = await response.json();
			expect(payload.error.code).toBe('WIG_TRY_ON_ABORTED');
		}
		expect(createWigCatalogSeam).not.toHaveBeenCalled();
	});

	it('rejects malformed JSON with INVALID_JSON code before creating any seams', async () => {
		vi.mocked(createAppConfigSeam).mockReset();
		vi.mocked(createWigCatalogSeam).mockReset();
		vi.mocked(createWigTryOnSeam).mockReset();

		const response = await POST(buildRawEvent('{not: valid json}'));
		const payload = await response.json();

		expect(response.status).toBe(400);
		expect(payload.ok).toBe(false);
		expect(payload.error.code).toBe('INVALID_JSON');
		expect(createAppConfigSeam).not.toHaveBeenCalled();
		expect(createWigCatalogSeam).not.toHaveBeenCalled();
		expect(createWigTryOnSeam).not.toHaveBeenCalled();
	});

	it('rejects schema-invalid payload with WIG_TRY_ON_INPUT_INVALID (not INVALID_JSON)', async () => {
		vi.mocked(createAppConfigSeam).mockReturnValue({} as ReturnType<typeof createAppConfigSeam>);
		vi.mocked(createWigCatalogSeam).mockReturnValue({
			listWigs: vi.fn(),
			getWigById: vi.fn()
		});
		vi.mocked(createWigTryOnSeam).mockReturnValue({ tryOn: vi.fn() });

		const response = await POST(buildEvent({ invalid: 'payload' }));
		const payload = await response.json();

		expect(response.status).toBe(400);
		expect(payload.ok).toBe(false);
		expect(payload.error.code).toBe('WIG_TRY_ON_INPUT_INVALID');
	});

	it('does not consume rate-limit quota for schema-invalid payloads', async () => {
		vi.mocked(createAppConfigSeam).mockReset();
		vi.mocked(createWigCatalogSeam).mockReset();
		vi.mocked(createWigTryOnSeam).mockReset();

		for (let i = 0; i < 25; i += 1) {
			const response = await POST(buildEvent({ invalid: 'payload' }));
			expect(response.status).toBe(400);
			const payload = await response.json();
			expect(payload.error.code).toBe('WIG_TRY_ON_INPUT_INVALID');
		}
		expect(createAppConfigSeam).not.toHaveBeenCalled();
		expect(createWigCatalogSeam).not.toHaveBeenCalled();
		expect(createWigTryOnSeam).not.toHaveBeenCalled();
	});

	it('rejects oversized selfieBase64 before the catalog preflight', async () => {
		vi.mocked(createAppConfigSeam).mockReset();
		vi.mocked(createWigCatalogSeam).mockReset();
		vi.mocked(createWigTryOnSeam).mockReset();
		const getWigById = vi.fn();
		vi.mocked(createWigCatalogSeam).mockReturnValue({ listWigs: vi.fn(), getWigById });

		const oversizedSelfie = 'a'.repeat(12_000_001);
		const response = await POST(
			buildEvent({ selfieBase64: oversizedSelfie, selfieMimeType: 'image/jpeg', wigId: 'missing-wig' })
		);
		const payload = await response.json();

		expect(response.status).toBe(400);
		expect(payload.ok).toBe(false);
		expect(payload.error.code).toBe('WIG_TRY_ON_INPUT_INVALID');
		expect(getWigById).not.toHaveBeenCalled();
		expect(createWigTryOnSeam).not.toHaveBeenCalled();
	});

	it('does not consume rate-limit quota for oversized-selfie payloads', async () => {
		vi.mocked(createAppConfigSeam).mockReset();
		vi.mocked(createWigCatalogSeam).mockReset();
		vi.mocked(createWigTryOnSeam).mockReset();
		const getWigById = vi.fn();
		vi.mocked(createWigCatalogSeam).mockReturnValue({ listWigs: vi.fn(), getWigById });

		// Asserting via a spy (rather than looping past the real rate-limit quota
		// to observe a would-be 429) keeps this test fast even with a ~12MB body —
		// repeating that body 25x pushed this test close to Vitest's 5s timeout.
		const enforceSpy = vi.spyOn(rateLimiterModule, 'enforceAiRateLimit');
		const oversizedSelfie = 'a'.repeat(12_000_001);
		for (let i = 0; i < 3; i += 1) {
			const response = await POST(
				buildEvent({ selfieBase64: oversizedSelfie, selfieMimeType: 'image/jpeg', wigId: 'missing-wig' })
			);
			expect(response.status).toBe(400);
			const payload = await response.json();
			expect(payload.error.code).toBe('WIG_TRY_ON_INPUT_INVALID');
		}
		expect(getWigById).not.toHaveBeenCalled();
		expect(enforceSpy).not.toHaveBeenCalled();
		enforceSpy.mockRestore();
	});

	it('rejects unknown wig IDs with WIG_NOT_FOUND before creating WigTryOnSeam', async () => {
		vi.mocked(createAppConfigSeam).mockReset();
		vi.mocked(createWigCatalogSeam).mockReset();
		vi.mocked(createWigTryOnSeam).mockReset();
		vi.mocked(createWigCatalogSeam).mockReturnValue({
			listWigs: vi.fn(),
			getWigById: vi.fn(async () => ({
				ok: false as const,
				error: {
					code: 'WIG_NOT_FOUND' as const,
					message: 'Wig not found.',
					details: { id: 'missing-wig' }
				}
			}))
		});

		const response = await POST(
			buildEvent({ selfieBase64: 'selfie-data', selfieMimeType: 'image/jpeg', wigId: 'missing-wig' })
		);
		const payload = await response.json();

		expect(response.status).toBe(404);
		expect(payload.ok).toBe(false);
		expect(payload.error.code).toBe('WIG_NOT_FOUND');
		expect(createAppConfigSeam).not.toHaveBeenCalled();
		expect(createWigTryOnSeam).not.toHaveBeenCalled();
	});

	it('does not consume rate-limit quota for unknown wig IDs', async () => {
		vi.mocked(createAppConfigSeam).mockReset();
		vi.mocked(createWigCatalogSeam).mockReset();
		vi.mocked(createWigTryOnSeam).mockReset();
		vi.mocked(createWigCatalogSeam).mockReturnValue({
			listWigs: vi.fn(),
			getWigById: vi.fn(async () => ({
				ok: false as const,
				error: {
					code: 'WIG_NOT_FOUND' as const,
					message: 'Wig not found.',
					details: { id: 'missing-wig' }
				}
			}))
		});

		for (let i = 0; i < 25; i += 1) {
			const response = await POST(
				buildEvent({ selfieBase64: 'selfie-data', selfieMimeType: 'image/jpeg', wigId: 'missing-wig' })
			);
			expect(response.status).toBe(404);
			const payload = await response.json();
			expect(payload.error.code).toBe('WIG_NOT_FOUND');
		}
		expect(createAppConfigSeam).not.toHaveBeenCalled();
		expect(createWigTryOnSeam).not.toHaveBeenCalled();
	});

	it('passes the request signal to wig image fetch and WigTryOnSeam', async () => {
		vi.mocked(createAppConfigSeam).mockReturnValue({
			getConfig: () => ({ geminiApiKey: 'test-key' }) as ReturnType<ReturnType<typeof createAppConfigSeam>['getConfig']>
		} as ReturnType<typeof createAppConfigSeam>);
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
		vi.mocked(createWigCatalogSeam).mockReturnValue({
			listWigs: vi.fn(),
			getWigById: vi.fn(async () => ({ ok: true as const, value: wig }))
		});
		const tryOn = vi.fn(async () => ({
			ok: true as const,
			value: {
				portraitBase64: 'portrait-data',
				portraitMimeType: 'image/png',
				timingMs: 10
			}
		}));
		vi.mocked(createWigTryOnSeam).mockReturnValue({ tryOn });
		const fetchImpl = vi.fn(async () =>
			new Response(new Uint8Array([1, 2, 3]), {
				status: 200,
				headers: { 'Content-Type': 'image/png' }
			})
		);
		const request = new Request('http://localhost/api/wig-try-on', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				selfieBase64: 'selfie-data',
				selfieMimeType: 'image/jpeg',
				wigId: wig.id
			})
		});

		const response = await POST({
			request,
			fetch: fetchImpl,
			getClientAddress: () => '203.0.113.10'
		} as unknown as Parameters<typeof POST>[0]);

		expect(response.status).toBe(200);
		expect(fetchImpl).toHaveBeenCalledWith(wig.imageUrl, { signal: request.signal });
		expect(tryOn).toHaveBeenCalledWith(expect.objectContaining({ signal: request.signal }));
	});

	it('rejects a request that aborts during catalog preflight before consuming rate-limit quota', async () => {
		vi.mocked(createAppConfigSeam).mockReset();
		vi.mocked(createWigCatalogSeam).mockReset();
		vi.mocked(createWigTryOnSeam).mockReset();

		const controller = new AbortController();
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
		vi.mocked(createWigCatalogSeam).mockReturnValue({
			listWigs: vi.fn(),
			getWigById: vi.fn(async () => {
				controller.abort();
				return { ok: true as const, value: wig };
			})
		});

		const request = new Request('http://localhost/api/wig-try-on', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				selfieBase64: 'selfie-data',
				selfieMimeType: 'image/jpeg',
				wigId: wig.id
			}),
			signal: controller.signal
		});

		const response = await POST({
			request,
			fetch: vi.fn(),
			getClientAddress: () => '203.0.113.10'
		} as unknown as Parameters<typeof POST>[0]);
		const payload = await response.json();

		expect(response.status).toBe(499);
		expect(payload.ok).toBe(false);
		expect(payload.error.code).toBe('WIG_TRY_ON_ABORTED');
		expect(createAppConfigSeam).not.toHaveBeenCalled();
		expect(createWigTryOnSeam).not.toHaveBeenCalled();
	});

	it('does not consume rate-limit quota when aborting during catalog preflight', async () => {
		vi.mocked(createAppConfigSeam).mockReset();
		vi.mocked(createWigCatalogSeam).mockReset();
		vi.mocked(createWigTryOnSeam).mockReset();

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

		for (let i = 0; i < 25; i += 1) {
			const controller = new AbortController();
			vi.mocked(createWigCatalogSeam).mockReturnValue({
				listWigs: vi.fn(),
				getWigById: vi.fn(async () => {
					controller.abort();
					return { ok: true as const, value: wig };
				})
			});

			const request = new Request('http://localhost/api/wig-try-on', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					selfieBase64: 'selfie-data',
					selfieMimeType: 'image/jpeg',
					wigId: wig.id
				}),
				signal: controller.signal
			});

			const response = await POST({
				request,
				fetch: vi.fn(),
				getClientAddress: () => '203.0.113.10'
			} as unknown as Parameters<typeof POST>[0]);
			expect(response.status).toBe(499);
			const payload = await response.json();
			expect(payload.error.code).toBe('WIG_TRY_ON_ABORTED');
		}
		expect(createAppConfigSeam).not.toHaveBeenCalled();
		expect(createWigTryOnSeam).not.toHaveBeenCalled();
	});
});
