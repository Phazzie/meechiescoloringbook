// Purpose: Unit tests for the server hook that attaches baseline security headers.
// Why: The headers are the whole point of the hook, so a silent regression that
//      dropped one would otherwise only be caught by inspecting a live response.
// Info flow: Fake event + resolve -> handle() -> assertions on response headers.
import { describe, expect, it, vi } from 'vitest';
import type { RequestEvent } from '@sveltejs/kit';
import { handle, SECURITY_HEADERS } from '../../src/hooks.server';

const runHandle = async (response = new Response('ok')) => {
	const resolve = vi.fn().mockResolvedValue(response);
	const event = {
		url: new URL('https://example.test/')
	} as unknown as RequestEvent;
	const result = await handle({ event, resolve } as Parameters<
		typeof handle
	>[0]);
	return { result, resolve };
};

describe('handle', () => {
	it('sets every declared security header on the response', async () => {
		const { result } = await runHandle();
		for (const [name, value] of SECURITY_HEADERS) {
			expect(result.headers.get(name)).toBe(value);
		}
	});

	it('refuses framing outright so the site cannot be embedded for clickjacking', async () => {
		const { result } = await runHandle();
		expect(result.headers.get('X-Frame-Options')).toBe('DENY');
	});

	it('forbids MIME sniffing, so an uploaded selfie cannot be re-read as script', async () => {
		const { result } = await runHandle();
		expect(result.headers.get('X-Content-Type-Options')).toBe('nosniff');
	});

	it('preserves the body and status produced by the route', async () => {
		const routeResponse = new Response('{"ok":true}', {
			status: 201,
			headers: { 'Content-Type': 'application/json' }
		});
		const { result } = await runHandle(routeResponse);
		expect(result.status).toBe(201);
		expect(result.headers.get('Content-Type')).toBe('application/json');
		await expect(result.text()).resolves.toBe('{"ok":true}');
	});

	it('overwrites a weaker header rather than appending a second value', async () => {
		const routeResponse = new Response('ok', {
			headers: { 'X-Frame-Options': 'SAMEORIGIN' }
		});
		const { result } = await runHandle(routeResponse);
		expect(result.headers.get('X-Frame-Options')).toBe('DENY');
	});
});
