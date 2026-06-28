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

let clientAddressCounter = 0;
const nextClientAddress = () => `198.51.100.${++clientAddressCounter}`;

const buildRawEvent = (
	rawBody: string,
	clientAddress: string = nextClientAddress()
): Parameters<typeof POST>[0] =>
	({
		request: new Request('http://localhost/api/wig-try-on', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: rawBody
		}),
		fetch: vi.fn(),
		getClientAddress: () => clientAddress
	}) as unknown as Parameters<typeof POST>[0];

const buildEvent = (
	body: unknown,
	clientAddress: string = nextClientAddress()
): Parameters<typeof POST>[0] =>
	({
		request: new Request('http://localhost/api/wig-try-on', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(body)
		}),
		fetch: vi.fn(),
		getClientAddress: () => clientAddress
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
			getClientAddress: () => nextClientAddress()
		} as unknown as Parameters<typeof POST>[0]);

		expect(response.status).toBe(200);
		expect(fetchImpl).toHaveBeenCalledWith(wig.imageUrl, { signal: request.signal });
		expect(tryOn).toHaveBeenCalledWith(expect.objectContaining({ signal: request.signal }));
	});

	it('returns 429 with RATE_LIMITED once a client exceeds the per-route limit', async () => {
		const clientAddress = '203.0.113.11';

		for (let i = 0; i < 5; i++) {
			const response = await POST(buildRawEvent('{not: valid json}', clientAddress));
			expect(response.status).not.toBe(429);
		}

		const limited = await POST(buildRawEvent('{not: valid json}', clientAddress));
		const payload = await limited.json();

		expect(limited.status).toBe(429);
		expect(payload.error.code).toBe('RATE_LIMITED');
	});
});
