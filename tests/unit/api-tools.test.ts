// Purpose: Verify /api/tools endpoint validation and safety behavior.
// Why: Keep Meechie tool requests contract-safe and blocked on disallowed content.
// Info flow: Request payload -> endpoint -> safety + adapter result.
import { afterEach, describe, expect, it, vi } from 'vitest';

// Lets a single test simulate the caller disconnecting while parseRequestBody's
// internal `await request.json()` is in flight, without touching any other test's
// behavior (the no-op default leaves parseRequestBody fully real/untouched).
const lateAbortRef = vi.hoisted(() => ({ controller: null as AbortController | null }));

// Stubbed (defaulting to true) so checkMeechieToolProviderConfig's hasProviderApiKey() check
// doesn't depend on a real XAI_API_KEY being present in the test process environment — the
// tests below mock the tool adapter's respond() directly instead. A dedicated test overrides
// this to false to exercise the missing-key preflight itself.
const hasProviderApiKeyRef = vi.hoisted(() => ({ value: true }));

vi.mock('$lib/adapters/provider-adapter.adapter', async () => {
	const actual = await vi.importActual<typeof import('$lib/adapters/provider-adapter.adapter')>(
		'$lib/adapters/provider-adapter.adapter'
	);
	return {
		...actual,
		hasProviderApiKey: () => hasProviderApiKeyRef.value
	};
});

vi.mock('$lib/server/parse-request-body', async () => {
	const actual = await vi.importActual<typeof import('$lib/server/parse-request-body')>(
		'$lib/server/parse-request-body'
	);
	return {
		parseRequestBody: async (request: Request) => {
			const parsed = await actual.parseRequestBody(request);
			if (parsed.ok) {
				lateAbortRef.controller?.abort();
			}
			return parsed;
		}
	};
});

import { POST } from '../../src/routes/api/tools/+server';
import { meechieToolAdapter } from '../../src/lib/adapters/meechie-tool-seam';

const buildEvent = (body: unknown): Parameters<typeof POST>[0] =>
	({
		request: new Request('http://localhost/api/tools', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(body)
		}),
		getClientAddress: () => '203.0.113.10'
	}) as Parameters<typeof POST>[0];

const buildRawEvent = (rawBody: string): Parameters<typeof POST>[0] =>
	({
		request: new Request('http://localhost/api/tools', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: rawBody
		}),
		getClientAddress: () => '203.0.113.10'
	}) as Parameters<typeof POST>[0];

const buildEventWithController = (
	body: unknown,
	controller: AbortController
): Parameters<typeof POST>[0] =>
	({
		request: new Request('http://localhost/api/tools', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(body),
			signal: controller.signal
		}),
		getClientAddress: () => '203.0.113.10'
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

	it('rejects schema-invalid payloads with MEECHIE_TOOL_INPUT_INVALID', async () => {
		const adapterSpy = vi.spyOn(meechieToolAdapter, 'respond');
		const response = await POST(buildEvent({ toolId: 'apology_translator' }));
		const payload = await response.json();

		expect(response.status).toBe(400);
		expect(payload.ok).toBe(false);
		expect(payload.error.code).toBe('MEECHIE_TOOL_INPUT_INVALID');
		expect(adapterSpy).not.toHaveBeenCalled();
	});

	it('does not consume rate-limit quota for schema-invalid payloads', async () => {
		const adapterSpy = vi.spyOn(meechieToolAdapter, 'respond');

		for (let i = 0; i < 25; i += 1) {
			const response = await POST(buildEvent({ toolId: 'apology_translator' }));
			expect(response.status).toBe(400);
			const payload = await response.json();
			expect(payload.error.code).toBe('MEECHIE_TOOL_INPUT_INVALID');
		}
		expect(adapterSpy).not.toHaveBeenCalled();
	});

	it('rejects free-text fields exceeding the max length before consuming rate-limit quota', async () => {
		const adapterSpy = vi.spyOn(meechieToolAdapter, 'respond');
		const oversizedApology = 'a'.repeat(2001);

		for (let i = 0; i < 25; i += 1) {
			const response = await POST(
				buildEvent({ toolId: 'apology_translator', apology: oversizedApology })
			);
			expect(response.status).toBe(400);
			const payload = await response.json();
			expect(payload.error.code).toBe('MEECHIE_TOOL_INPUT_INVALID');
		}
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

	it('does not consume rate-limit quota for disallowed-content payloads', async () => {
		const adapterSpy = vi.spyOn(meechieToolAdapter, 'respond');

		for (let i = 0; i < 25; i += 1) {
			const response = await POST(
				buildEvent({
					toolId: 'apology_translator',
					apology: 'This is self-harm content.'
				})
			);
			expect(response.status).toBe(400);
			const payload = await response.json();
			expect(payload.error.code).toBe('DISALLOWED_CONTENT');
		}
		expect(adapterSpy).not.toHaveBeenCalled();
	});

	it('rejects a request that aborts while the body is being parsed before consuming rate-limit quota', async () => {
		const adapterSpy = vi.spyOn(meechieToolAdapter, 'respond');
		const controller = new AbortController();
		lateAbortRef.controller = controller;

		try {
			const response = await POST(
				buildEventWithController({ toolId: 'apology_translator', apology: 'My bad' }, controller)
			);
			const payload = await response.json();

			expect(response.status).toBe(499);
			expect(payload.ok).toBe(false);
			expect(payload.error.code).toBe('MEECHIE_TOOL_ABORTED');
			expect(adapterSpy).not.toHaveBeenCalled();
		} finally {
			lateAbortRef.controller = null;
		}
	});

	it('does not consume rate-limit quota when aborting while the body is being parsed', async () => {
		const adapterSpy = vi.spyOn(meechieToolAdapter, 'respond');

		try {
			for (let i = 0; i < 25; i += 1) {
				const controller = new AbortController();
				lateAbortRef.controller = controller;
				const response = await POST(
					buildEventWithController(
						{ toolId: 'apology_translator', apology: 'My bad' },
						controller
					)
				);
				expect(response.status).toBe(499);
				const payload = await response.json();
				expect(payload.error.code).toBe('MEECHIE_TOOL_ABORTED');
			}
			expect(adapterSpy).not.toHaveBeenCalled();
		} finally {
			lateAbortRef.controller = null;
		}
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

	it('returns PROVIDER_API_KEY_MISSING before invoking the tool adapter when XAI_API_KEY is unset', async () => {
		const adapterSpy = vi.spyOn(meechieToolAdapter, 'respond');
		hasProviderApiKeyRef.value = false;

		try {
			const response = await POST(
				buildEvent({ toolId: 'apology_translator', apology: "I'm sorry you feel that way." })
			);
			const payload = await response.json();

			expect(response.status).toBe(200);
			expect(payload).toEqual({
				ok: false,
				error: {
					code: 'PROVIDER_API_KEY_MISSING',
					message: 'AI tools require XAI_API_KEY to be set on the server.'
				}
			});
			expect(adapterSpy).not.toHaveBeenCalled();
		} finally {
			hasProviderApiKeyRef.value = true;
		}
	});
});
