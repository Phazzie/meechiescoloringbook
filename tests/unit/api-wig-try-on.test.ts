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

describe('/api/wig-try-on', () => {
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
		vi.mocked(createAppConfigSeam).mockReturnValue({} as ReturnType<typeof createAppConfigSeam>);
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
});
