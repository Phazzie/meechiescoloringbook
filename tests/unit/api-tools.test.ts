// Purpose: Verify /api/tools endpoint validation and safety behavior.
// Why: Keep Meechie tool requests contract-safe and blocked on disallowed content.
// Info flow: Request payload -> endpoint -> safety + adapter result.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { POST } from '../../src/routes/api/tools/+server';
import { meechieToolAdapter } from '../../src/lib/adapters/meechie-tool-seam';
import { createClientAddressCounter } from '../helpers/client-address';

const nextClientAddress = createClientAddressCounter();

const buildEvent = (
	body: unknown,
	clientAddress: string = nextClientAddress()
): Parameters<typeof POST>[0] =>
	({
		request: new Request('http://localhost/api/tools', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(body)
		}),
		getClientAddress: () => clientAddress
	}) as Parameters<typeof POST>[0];

const buildRawEvent = (
	rawBody: string,
	clientAddress: string = nextClientAddress()
): Parameters<typeof POST>[0] =>
	({
		request: new Request('http://localhost/api/tools', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: rawBody
		}),
		getClientAddress: () => clientAddress
	}) as Parameters<typeof POST>[0];

afterEach(() => {
	vi.restoreAllMocks();
});

describe('/api/tools', () => {
	it('rejects malformed JSON with INVALID_JSON code', async () => {
		const adapterSpy = vi.spyOn(meechieToolAdapter, 'respond');
		const response = await POST(buildRawEvent('{not: valid json}'));
		const payload = await response.json();

		expect(response.status).toBe(400);
		expect(payload.ok).toBe(false);
		expect(payload.error.code).toBe('INVALID_JSON');
		expect(adapterSpy).not.toHaveBeenCalled();
	});

	it('rejects disallowed content and does not invoke adapter', async () => {
		const adapterSpy = vi.spyOn(meechieToolAdapter, 'respond');
		const response = await POST(
			buildEvent({
				toolId: 'apology_translator',
				apology: 'This is self-harm content.'
			})
		);
		const payload = await response.json();

		expect(response.status).toBe(400);
		expect(payload.ok).toBe(false);
		expect(payload.error.code).toBe('DISALLOWED_CONTENT');
		expect(adapterSpy).not.toHaveBeenCalled();
	});

	it('returns adapter output for valid input', async () => {
		vi.spyOn(meechieToolAdapter, 'respond').mockResolvedValue({
			ok: true,
			value: {
				toolId: 'apology_translator',
				headline: 'Decoded',
				response: 'That apology was weak.'
			}
		});

		const response = await POST(
			buildEvent({
				toolId: 'apology_translator',
				apology: "I'm sorry you feel that way."
			})
		);
		const payload = await response.json();

		expect(response.status).toBe(200);
		expect(payload).toEqual({
			ok: true,
			value: {
				toolId: 'apology_translator',
				headline: 'Decoded',
				response: 'That apology was weak.'
			}
		});
	});

	it('returns 429 with RATE_LIMITED once a client exceeds the per-route limit', async () => {
		const clientAddress = '203.0.113.10';
		const body = { toolId: 'apology_translator', apology: 'This is self-harm content.' };

		for (let i = 0; i < 10; i++) {
			const response = await POST(buildEvent(body, clientAddress));
			expect(response.status).not.toBe(429);
		}

		const limited = await POST(buildEvent(body, clientAddress));
		const payload = await limited.json();

		expect(limited.status).toBe(429);
		expect(payload.error.code).toBe('RATE_LIMITED');
	});
});
