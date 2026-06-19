// Purpose: Verify the rate-limiting Handle hook gates POST /api/* and passes through everything else.
// Why: hooks.server.ts is the single enforcement point for abuse protection on billable endpoints.
// Info flow: mock RequestEvent -> handle() -> 429 short-circuit or resolve(event) passthrough.
import { describe, expect, it, vi } from 'vitest';
import { handle } from '../../src/hooks.server';

type HandleEvent = Parameters<typeof handle>[0]['event'];

const buildEvent = (
	method: string,
	pathname: string,
	clientAddress: string
): HandleEvent =>
	({
		request: new Request(`http://localhost${pathname}`, { method }),
		url: new URL(`http://localhost${pathname}`),
		getClientAddress: () => clientAddress
	}) as HandleEvent;

describe('hooks.server handle (RateLimitSeam enforcement)', () => {
	it('passes through non-API paths without invoking the limiter', async () => {
		const resolve = vi.fn(async () => new Response('ok'));
		const event = buildEvent('POST', '/builder', 'ip:hooks-test-1');
		const response = await handle({ event, resolve });
		expect(resolve).toHaveBeenCalledOnce();
		expect(await response.text()).toBe('ok');
	});

	it('passes through GET requests to /api/* without invoking the limiter', async () => {
		const resolve = vi.fn(async () => new Response('ok'));
		const event = buildEvent('GET', '/api/generate', 'ip:hooks-test-2');
		const response = await handle({ event, resolve });
		expect(resolve).toHaveBeenCalledOnce();
		expect(await response.text()).toBe('ok');
	});

	it('passes through POST /api/* requests that are under the limit', async () => {
		const resolve = vi.fn(async () => new Response('ok'));
		const event = buildEvent('POST', '/api/generate', 'ip:hooks-test-3');
		const response = await handle({ event, resolve });
		expect(resolve).toHaveBeenCalledOnce();
		expect(await response.text()).toBe('ok');
	});

	it('returns 429 once the default per-instance limit is exceeded for one key', async () => {
		const resolve = vi.fn(async () => new Response('ok'));
		const key = 'ip:hooks-test-4';

		let lastResponse: Response | undefined;
		for (let i = 0; i < 25; i += 1) {
			const event = buildEvent('POST', '/api/generate', key);
			lastResponse = await handle({ event, resolve });
		}

		expect(lastResponse?.status).toBe(429);
		const payload = await lastResponse?.json();
		expect(payload.ok).toBe(false);
		expect(payload.error.code).toBe('RATE_LIMITED');
		expect(lastResponse?.headers.get('Retry-After')).toBeTruthy();
	});

	it('tracks rate limits independently per client address', async () => {
		const resolve = vi.fn(async () => new Response('ok'));
		const exhaustedKey = 'ip:hooks-test-5';
		const freshKey = 'ip:hooks-test-6';

		for (let i = 0; i < 25; i += 1) {
			await handle({
				event: buildEvent('POST', '/api/generate', exhaustedKey),
				resolve
			});
		}

		const response = await handle({
			event: buildEvent('POST', '/api/generate', freshKey),
			resolve
		});
		expect(response.status).not.toBe(429);
	});
});
