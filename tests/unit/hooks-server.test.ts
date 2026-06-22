// Purpose: Verify the global security-header hook attaches expected headers.
// Why: hooks.server.ts has no contract/seam; a focused unit test is the only
//      guard against silently losing header coverage on a future edit.
// Info flow: Fake RequestEvent -> handle() -> resolve() -> asserted response headers.
import { describe, expect, it } from 'vitest';
import { handle } from '../../src/hooks.server';

const buildEvent = () => ({}) as Parameters<typeof handle>[0]['event'];

describe('hooks.server handle', () => {
	it('attaches baseline security headers to every response', async () => {
		const resolve = async () => new Response('ok');
		const response = await handle({ event: buildEvent(), resolve } as unknown as Parameters<
			typeof handle
		>[0]);

		expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff');
		expect(response.headers.get('X-Frame-Options')).toBe('DENY');
		expect(response.headers.get('Referrer-Policy')).toBe('strict-origin-when-cross-origin');
		expect(response.headers.get('Permissions-Policy')).toBe(
			'camera=(), microphone=(), geolocation=()'
		);
		expect(response.headers.get('Strict-Transport-Security')).toBe(
			'max-age=63072000; includeSubDomains; preload'
		);
	});

	it('preserves the original response body and status', async () => {
		const resolve = async () => new Response('hello', { status: 201 });
		const response = await handle({ event: buildEvent(), resolve } as unknown as Parameters<
			typeof handle
		>[0]);

		expect(response.status).toBe(201);
		expect(await response.text()).toBe('hello');
	});
});
