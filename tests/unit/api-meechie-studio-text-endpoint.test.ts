// Purpose: Verify /api/meechie-studio-text rejects malformed JSON before pipeline invocation.
// Why: Ensure the INVALID_JSON guard fires and pipelines don't receive broken input.
// Info flow: Raw request -> parseRequestBody -> INVALID_JSON response (no pipeline calls).
import { describe, expect, it } from 'vitest';
import { POST } from '../../src/routes/api/meechie-studio-text/+server';

const buildRawEvent = (rawBody: string): Parameters<typeof POST>[0] =>
	({
		request: new Request('http://localhost/api/meechie-studio-text', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: rawBody
		}),
		getClientAddress: () => '203.0.113.10'
	}) as Parameters<typeof POST>[0];

const buildEvent = (body: unknown): Parameters<typeof POST>[0] =>
	({
		request: new Request('http://localhost/api/meechie-studio-text', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(body)
		}),
		getClientAddress: () => '203.0.113.10'
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

	it('does not consume rate-limit quota for schema-invalid payloads', async () => {
		for (let i = 0; i < 25; i += 1) {
			const response = await POST(buildEvent({ invalid: 'payload' }));
			expect(response.status).toBe(400);
			const payload = await response.json();
			expect(payload.error.code).toBe('MEECHIE_STUDIO_TEXT_INPUT_INVALID');
		}
	});

	it('does not consume rate-limit quota for disallowed-content payloads', async () => {
		const disallowedPayload = {
			actionId: 'generate',
			modeId: 'test',
			modeLabel: 'Test Mode',
			themeLabel: 'Test Theme',
			evidence: 'evidence mentioning minors in coloring books',
			voice: {
				intensity: 'receipts_out',
				rawness: 'mild',
				thirdPerson: 'sometimes'
			}
		};

		for (let i = 0; i < 25; i += 1) {
			const response = await POST(buildEvent(disallowedPayload));
			expect(response.status).toBe(400);
			const payload = await response.json();
			expect(payload.error.code).toBe('DISALLOWED_CONTENT');
		}
	});
});
