// Purpose: Verify /api/wig-try-on parsing, narrow xAI configuration, and signal forwarding.
// Why: Prevent malformed input from creating seams and keep valid requests off broad legacy config.
// Info flow: Request -> parse guard -> catalog/config/provider seams -> pipeline response assertions.
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('$lib/adapters/app-config-seam/index', () => ({
	createAppConfigSeam: vi.fn()
}));
vi.mock('$lib/adapters/image-provider-config-seam/index', () => ({
	createImageProviderConfigSeam: vi.fn()
}));
vi.mock('$lib/adapters/wig-catalog-seam/index', () => ({
	createWigCatalogSeam: vi.fn()
}));
vi.mock('$lib/adapters/wig-try-on-seam/index', () => ({
	createWigTryOnSeam: vi.fn()
}));

import { createAppConfigSeam } from '$lib/adapters/app-config-seam/index';
import { createImageProviderConfigSeam } from '$lib/adapters/image-provider-config-seam/index';
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
		fetch: vi.fn()
	}) as unknown as Parameters<typeof POST>[0];

const buildEvent = (body: unknown): Parameters<typeof POST>[0] =>
	({
		request: new Request('http://localhost/api/wig-try-on', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(body)
		}),
		fetch: vi.fn()
	}) as unknown as Parameters<typeof POST>[0];

describe('/api/wig-try-on', () => {
	beforeEach(() => {
		vi.mocked(createAppConfigSeam).mockReset();
		vi.mocked(createImageProviderConfigSeam).mockReset();
		vi.mocked(createWigCatalogSeam).mockReset();
		vi.mocked(createWigTryOnSeam).mockReset();
	});

	it('rejects malformed JSON with INVALID_JSON code before creating any seams', async () => {
		const response = await POST(buildRawEvent('{not: valid json}'));
		const payload = await response.json();

		expect(response.status).toBe(400);
		expect(payload.ok).toBe(false);
		expect(payload.error.code).toBe('INVALID_JSON');
		expect(createAppConfigSeam).not.toHaveBeenCalled();
		expect(createImageProviderConfigSeam).not.toHaveBeenCalled();
		expect(createWigCatalogSeam).not.toHaveBeenCalled();
		expect(createWigTryOnSeam).not.toHaveBeenCalled();
	});

	it('rejects schema-invalid payload with WIG_TRY_ON_INPUT_INVALID (not INVALID_JSON)', async () => {
		vi.mocked(createAppConfigSeam).mockReturnValue({} as ReturnType<typeof createAppConfigSeam>);
		vi.mocked(createImageProviderConfigSeam).mockReturnValue(
			{} as ReturnType<typeof createImageProviderConfigSeam>
		);
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

	it('creates narrow xAI config and passes the request signal to the wig pipeline seams', async () => {
		vi.mocked(createAppConfigSeam).mockReturnValue({} as ReturnType<typeof createAppConfigSeam>);
		const configSeam = { getConfig: vi.fn() };
		vi.mocked(createImageProviderConfigSeam).mockReturnValue(configSeam);
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
			new Response(new Uint8Array([0xff, 0xd8, 0xff, 0xd9]), {
				status: 200,
				headers: { 'Content-Type': 'image/jpeg' }
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
			fetch: fetchImpl
		} as unknown as Parameters<typeof POST>[0]);

		expect(response.status).toBe(200);
		expect(createAppConfigSeam).not.toHaveBeenCalled();
		expect(createImageProviderConfigSeam).toHaveBeenCalledOnce();
		expect(createWigTryOnSeam).toHaveBeenCalledWith(configSeam);
		expect(fetchImpl).toHaveBeenCalledWith(wig.imageUrl, { signal: request.signal });
		expect(tryOn).toHaveBeenCalledWith(expect.objectContaining({ signal: request.signal }));
	});
});
