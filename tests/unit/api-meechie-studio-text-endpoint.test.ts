// Purpose: Verify /api/meechie-studio-text rejects malformed JSON before pipeline invocation.
// Why: Ensure the INVALID_JSON guard fires and pipelines don't receive broken input.
// Info flow: Raw request -> parseRequestBody -> INVALID_JSON response (no pipeline calls).
import { describe, expect, it } from 'vitest';
import { POST } from '../../src/routes/api/meechie-studio-text/+server';

let clientAddressCounter = 0;
const nextClientAddress = () => `198.51.100.${++clientAddressCounter}`;

const buildRawEvent = (
	rawBody: string,
	clientAddress: string = nextClientAddress()
): Parameters<typeof POST>[0] =>
	({
		request: new Request('http://localhost/api/meechie-studio-text', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: rawBody
		}),
		getClientAddress: () => clientAddress
	}) as Parameters<typeof POST>[0];

const buildEvent = (
	body: unknown,
	clientAddress: string = nextClientAddress()
): Parameters<typeof POST>[0] =>
	({
		request: new Request('http://localhost/api/meechie-studio-text', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(body)
		}),
		getClientAddress: () => clientAddress
	}) as Parameters<typeof POST>[0];

describe('/api/meechie-studio-text', () => {
	it('rejects malformed JSON with INVALID_JSON code', async () => {
		const response = await POST(buildRawEvent('{not: valid json}'));
		const payload = await response.json();

		expect(response.status).toBe(400);
		expect(payload.ok).toBe(false);
		expect(payload.error.code).toBe('INVALID_JSON');
	});

	it('rejects schema-invalid payload with STUDIO_TEXT_INPUT_INVALID (not INVALID_JSON)', async () => {
		const response = await POST(buildEvent({ invalid: 'payload' }));
		const payload = await response.json();

		expect(response.status).toBe(400);
		expect(payload.ok).toBe(false);
		expect(payload.error.code).toBe('MEECHIE_STUDIO_TEXT_INPUT_INVALID');
	});

	it('returns 429 with RATE_LIMITED once a client exceeds the per-route limit', async () => {
		const clientAddress = '203.0.113.12';

		for (let i = 0; i < 10; i++) {
			const response = await POST(buildEvent({ invalid: 'payload' }, clientAddress));
			expect(response.status).not.toBe(429);
		}

		const limited = await POST(buildEvent({ invalid: 'payload' }, clientAddress));
		const payload = await limited.json();

		expect(limited.status).toBe(429);
		expect(payload.error.code).toBe('RATE_LIMITED');
	});
});
