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
vi.mock('$lib/server/rate-limit-route', () => ({
	createQuotaGate: vi.fn()
}));

import { createAppConfigSeam } from '$lib/adapters/app-config-seam/index';
import { createImageProviderConfigSeam } from '$lib/adapters/image-provider-config-seam/index';
import { createWigCatalogSeam } from '$lib/adapters/wig-catalog-seam/index';
import { createWigTryOnSeam } from '$lib/adapters/wig-try-on-seam/index';
import { createQuotaGate } from '$lib/server/rate-limit-route';
import type { QuotaDecision } from '$lib/server/rate-limit-route';
import { POST } from '../../src/routes/api/wig-try-on/+server';

const CLIENT_ADDRESS = '203.0.113.7';

const ALLOWED_HEADERS = {
	'Cache-Control': 'no-store',
	'RateLimit-Limit': '8',
	'RateLimit-Remaining': '7',
	'RateLimit-Reset': '58'
};

const gateReturning = (decision: QuotaDecision) => {
	const consumeQuota = vi.fn(async (_cost: number) => decision);
	vi.mocked(createQuotaGate).mockReturnValue(consumeQuota);
	return consumeQuota;
};

const allowingGate = () => gateReturning({ ok: true, headers: ALLOWED_HEADERS });

const providerLeakCanary =
	'RAW_PROVIDER_BODY https://api.x.ai/v1/responses?key=xai-secret-canary 550e8400-e29b-41d4-a716-446655440000 account=acct-canary team=team-canary';

const expectProviderLeakCanaryRedacted = (payload: unknown): void => {
	const serialized = JSON.stringify(payload);
	expect(serialized).not.toContain('RAW_PROVIDER_BODY');
	expect(serialized).not.toContain(
		'https://api.x.ai/v1/responses?key=xai-secret-canary'
	);
	expect(serialized).not.toContain('xai-secret-canary');
	expect(serialized).not.toContain('550e8400-e29b-41d4-a716-446655440000');
	expect(serialized).not.toContain('acct-canary');
	expect(serialized).not.toContain('team-canary');
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

const buildRawEvent = (rawBody: string): Parameters<typeof POST>[0] =>
	({
		request: new Request('http://localhost/api/wig-try-on', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: rawBody
		}),
		fetch: vi.fn(),
		getClientAddress: () => CLIENT_ADDRESS
	}) as unknown as Parameters<typeof POST>[0];

const buildEvent = (body: unknown): Parameters<typeof POST>[0] =>
	({
		request: new Request('http://localhost/api/wig-try-on', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(body)
		}),
		fetch: vi.fn(),
		getClientAddress: () => CLIENT_ADDRESS
	}) as unknown as Parameters<typeof POST>[0];

describe('/api/wig-try-on', () => {
	beforeEach(() => {
		vi.mocked(createAppConfigSeam).mockReset();
		vi.mocked(createImageProviderConfigSeam).mockReset();
		vi.mocked(createWigCatalogSeam).mockReset();
		vi.mocked(createWigTryOnSeam).mockReset();
		vi.mocked(createQuotaGate).mockReset();
		allowingGate();
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
		expect(createQuotaGate).not.toHaveBeenCalled();
	});

	it('rejects schema-invalid payload with WIG_TRY_ON_INPUT_INVALID (not INVALID_JSON)', async () => {
		vi.mocked(createAppConfigSeam).mockReturnValue(
			{} as ReturnType<typeof createAppConfigSeam>
		);
		vi.mocked(createImageProviderConfigSeam).mockReturnValue(
			{} as ReturnType<typeof createImageProviderConfigSeam>
		);
		vi.mocked(createWigCatalogSeam).mockReturnValue({
			listWigs: vi.fn(),
			getWigById: vi.fn()
		});
		vi.mocked(createWigTryOnSeam).mockReturnValue({ tryOn: vi.fn() });
		const consumeQuota = allowingGate();

		const response = await POST(buildEvent({ invalid: 'payload' }));
		const payload = await response.json();

		expect(response.status).toBe(400);
		expect(payload.ok).toBe(false);
		expect(payload.error.code).toBe('WIG_TRY_ON_INPUT_INVALID');
		expect(consumeQuota).not.toHaveBeenCalled();
		expect(response.headers.get('RateLimit-Remaining')).toBeNull();
	});

	it('creates narrow xAI config and passes the request signal to the wig pipeline seams', async () => {
		vi.mocked(createAppConfigSeam).mockReturnValue(
			{} as ReturnType<typeof createAppConfigSeam>
		);
		const configSeam = { getConfig: vi.fn() };
		vi.mocked(createImageProviderConfigSeam).mockReturnValue(configSeam);
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
		const fetchImpl = vi.fn(
			async () =>
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
			fetch: fetchImpl,
			getClientAddress: () => CLIENT_ADDRESS
		} as unknown as Parameters<typeof POST>[0]);

		expect(response.status).toBe(200);
		expect(createAppConfigSeam).not.toHaveBeenCalled();
		expect(createImageProviderConfigSeam).toHaveBeenCalledOnce();
		expect(createWigTryOnSeam).toHaveBeenCalledWith(configSeam);
		expect(fetchImpl).toHaveBeenCalledWith(wig.imageUrl, {
			signal: request.signal
		});
		expect(tryOn).toHaveBeenCalledWith(
			expect.objectContaining({ signal: request.signal })
		);
	});

	it('does not serialize upstream provider diagnostics', async () => {
		const configSeam = { getConfig: vi.fn() };
		vi.mocked(createImageProviderConfigSeam).mockReturnValue(configSeam);
		vi.mocked(createWigCatalogSeam).mockReturnValue({
			listWigs: vi.fn(),
			getWigById: vi.fn(async () => ({ ok: true as const, value: wig }))
		});
		vi.mocked(createWigTryOnSeam).mockReturnValue({
			tryOn: vi.fn(async () => ({
				ok: false as const,
				error: {
					code: 'WIG_TRY_ON_HTTP_ERROR' as const,
					message: providerLeakCanary,
					details: {
						body: providerLeakCanary,
						accountId: 'acct-canary',
						teamId: 'team-canary'
					}
				}
			}))
		});
		const fetchImpl = vi.fn(
			async () =>
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
			fetch: fetchImpl,
			getClientAddress: () => CLIENT_ADDRESS
		} as unknown as Parameters<typeof POST>[0]);
		const payload = await response.json();

		expect(response.status).toBe(502);
		expect(payload.ok).toBe(false);
		expect(payload.error.code).toBe('WIG_TRY_ON_HTTP_ERROR');
		expectProviderLeakCanaryRedacted(payload);
	});

	it('returns the gate 429 with Retry-After and never calls the provider', async () => {
		const consumeQuota = gateReturning({
			ok: false,
			status: 429,
			headers: {
				'Cache-Control': 'no-store',
				'RateLimit-Limit': '8',
				'RateLimit-Remaining': '0',
				'RateLimit-Reset': '42',
				'Retry-After': '42'
			},
			body: {
				ok: false,
				error: {
					code: 'RATE_LIMITED',
					message: 'Too many requests. Try again after the current window resets.'
				}
			}
		});
		vi.mocked(createImageProviderConfigSeam).mockReturnValue({ getConfig: vi.fn() });
		vi.mocked(createWigCatalogSeam).mockReturnValue({
			listWigs: vi.fn(),
			getWigById: vi.fn(async () => ({ ok: true as const, value: wig }))
		});
		// Resolves successfully on purpose: if the gate is skipped the route returns 200 and the
		// assertions below name the real defect instead of crashing on an unstubbed provider.
		const tryOn = vi.fn(async () => ({
			ok: true as const,
			value: {
				portraitBase64: 'portrait-data',
				portraitMimeType: 'image/png',
				timingMs: 10
			}
		}));
		vi.mocked(createWigTryOnSeam).mockReturnValue({ tryOn });
		const fetchImpl = vi.fn(
			async () =>
				new Response(new Uint8Array([0xff, 0xd8, 0xff, 0xd9]), { status: 200 })
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
			getClientAddress: () => CLIENT_ADDRESS
		} as unknown as Parameters<typeof POST>[0]);
		const payload = await response.json();

		expect(response.status).toBe(429);
		expect(response.headers.get('Retry-After')).toBe('42');
		expect(response.headers.get('RateLimit-Remaining')).toBe('0');
		expect(response.headers.get('RateLimit-Reset')).toBe('42');
		expect(response.headers.get('Cache-Control')).toBe('no-store');
		expect(payload).toEqual({
			ok: false,
			error: {
				code: 'RATE_LIMITED',
				message: 'Too many requests. Try again after the current window resets.'
			}
		});
		expect(consumeQuota).toHaveBeenCalledWith(1);
		expect(createQuotaGate).toHaveBeenCalledWith(
			expect.objectContaining({ getClientAddress: expect.any(Function) }),
			'image'
		);
		expect(tryOn).not.toHaveBeenCalled();
	});

	it('charges the image bucket once and advertises the remaining quota', async () => {
		const consumeQuota = allowingGate();
		vi.mocked(createImageProviderConfigSeam).mockReturnValue({ getConfig: vi.fn() });
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
		const fetchImpl = vi.fn(
			async () =>
				new Response(new Uint8Array([0xff, 0xd8, 0xff, 0xd9]), { status: 200 })
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
			getClientAddress: () => CLIENT_ADDRESS
		} as unknown as Parameters<typeof POST>[0]);

		expect(response.status).toBe(200);
		expect(consumeQuota).toHaveBeenCalledTimes(1);
		expect(consumeQuota).toHaveBeenCalledWith(1);
		expect(response.headers.get('RateLimit-Limit')).toBe('8');
		expect(response.headers.get('RateLimit-Remaining')).toBe('7');
		expect(response.headers.get('RateLimit-Reset')).toBe('58');
		expect(response.headers.get('Cache-Control')).toBe('no-store');
		expect(tryOn).toHaveBeenCalledTimes(1);
	});

	it('builds the gate from the real event address lookup, not a header', async () => {
		const getClientAddress = vi.fn(() => CLIENT_ADDRESS);
		allowingGate();
		vi.mocked(createImageProviderConfigSeam).mockReturnValue({ getConfig: vi.fn() });
		vi.mocked(createWigCatalogSeam).mockReturnValue({
			listWigs: vi.fn(),
			getWigById: vi.fn(async () => ({ ok: true as const, value: wig }))
		});
		vi.mocked(createWigTryOnSeam).mockReturnValue({
			tryOn: vi.fn(async () => ({
				ok: true as const,
				value: {
					portraitBase64: 'portrait-data',
					portraitMimeType: 'image/png',
					timingMs: 10
				}
			}))
		});
		const request = new Request('http://localhost/api/wig-try-on', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'X-Forwarded-For': '198.51.100.23'
			},
			body: JSON.stringify({
				selfieBase64: 'selfie-data',
				selfieMimeType: 'image/jpeg',
				wigId: wig.id
			})
		});

		await POST({
			request,
			fetch: vi.fn(
				async () =>
					new Response(new Uint8Array([0xff, 0xd8, 0xff, 0xd9]), { status: 200 })
			),
			getClientAddress
		} as unknown as Parameters<typeof POST>[0]);

		expect(createQuotaGate).toHaveBeenCalledTimes(1);
		const [gateEvent, bucket] = vi.mocked(createQuotaGate).mock.calls[0] ?? [];
		expect(bucket).toBe('image');
		expect(gateEvent?.getClientAddress).toBe(getClientAddress);
	});

	it('fails closed with the gate 503 and never calls the provider', async () => {
		const consumeQuota = gateReturning({
			ok: false,
			status: 503,
			headers: { 'Cache-Control': 'no-store' },
			body: {
				ok: false,
				error: {
					code: 'RATE_LIMIT_UNAVAILABLE',
					message: 'Rate limiting is temporarily unavailable.'
				}
			}
		});
		vi.mocked(createImageProviderConfigSeam).mockReturnValue({ getConfig: vi.fn() });
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
			fetch: vi.fn(
				async () =>
					new Response(new Uint8Array([0xff, 0xd8, 0xff, 0xd9]), { status: 200 })
			),
			getClientAddress: () => CLIENT_ADDRESS
		} as unknown as Parameters<typeof POST>[0]);
		const payload = await response.json();

		expect(response.status).toBe(503);
		// Same status as W8's provider-config 503, told apart by the code.
		expect(payload.error.code).toBe('RATE_LIMIT_UNAVAILABLE');
		expect(payload.error.code).not.toBe('WIG_TRY_ON_CONFIG_ERROR');
		expect(response.headers.get('Cache-Control')).toBe('no-store');
		expect(response.headers.get('Retry-After')).toBeNull();
		expect(consumeQuota).toHaveBeenCalledWith(1);
		expect(tryOn).not.toHaveBeenCalled();
	});

	it('leaves the W8 status mapping intact for a missing wig and an unloadable wig image', async () => {
		vi.mocked(createImageProviderConfigSeam).mockReturnValue({ getConfig: vi.fn() });
		const tryOn = vi.fn();
		vi.mocked(createWigTryOnSeam).mockReturnValue({ tryOn });

		const missingGate = allowingGate();
		vi.mocked(createWigCatalogSeam).mockReturnValue({
			listWigs: vi.fn(),
			getWigById: vi.fn(async () => ({
				ok: false as const,
				error: {
					code: 'WIG_NOT_FOUND' as const,
					message: 'no such wig',
					details: { id: 'wig-nope' }
				}
			}))
		});
		const missing = await POST(
			buildEvent({
				selfieBase64: 'selfie-data',
				selfieMimeType: 'image/jpeg',
				wigId: 'wig-nope'
			})
		);

		expect(missing.status).toBe(404);
		expect((await missing.json()).error.code).toBe('WIG_NOT_FOUND');
		expect(missingGate).not.toHaveBeenCalled();

		const fetchFailureGate = allowingGate();
		vi.mocked(createWigCatalogSeam).mockReturnValue({
			listWigs: vi.fn(),
			getWigById: vi.fn(async () => ({ ok: true as const, value: wig }))
		});
		const unloadable = await POST({
			request: new Request('http://localhost/api/wig-try-on', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					selfieBase64: 'selfie-data',
					selfieMimeType: 'image/jpeg',
					wigId: wig.id
				})
			}),
			fetch: vi.fn(async () => new Response('gone', { status: 404 })),
			getClientAddress: () => CLIENT_ADDRESS
		} as unknown as Parameters<typeof POST>[0]);

		expect(unloadable.status).toBe(502);
		expect((await unloadable.json()).error.code).toBe('WIG_IMAGE_FETCH_FAILED');
		expect(fetchFailureGate).not.toHaveBeenCalled();
		expect(tryOn).not.toHaveBeenCalled();
	});
});
