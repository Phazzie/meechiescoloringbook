// Purpose: Verify /api/meechie-studio-text rejects malformed JSON before pipeline invocation.
// Why: Ensure the INVALID_JSON guard fires and pipelines don't receive broken input.
// Info flow: Raw request -> parseRequestBody -> INVALID_JSON response (no pipeline calls).
import { describe, expect, it, vi } from 'vitest';

// Lets a single test simulate the caller disconnecting while parseRequestBody's
// internal `await request.json()` is in flight, without touching any other test's
// behavior (the no-op default leaves parseRequestBody fully real/untouched).
const lateAbortRef = vi.hoisted(() => ({ controller: null as AbortController | null }));

vi.mock('$lib/server/parse-request-body', async () => {
	const actual = await vi.importActual<typeof import('$lib/server/parse-request-body')>(
		'$lib/server/parse-request-body'
	);
	return {
		parseRequestBody: async (request: Request) => {
			lateAbortRef.controller?.abort();
			return actual.parseRequestBody(request);
		}
	};
});

const envRef = vi.hoisted(() => ({ XAI_API_KEY: 'test-key' as string | undefined }));
vi.mock('$env/dynamic/private', () => ({ env: envRef }));

import { POST } from '../../src/routes/api/meechie-studio-text/+server';
import * as providerAdapterModule from '../../src/lib/adapters/provider-adapter.adapter';

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

const buildAbortedEvent = (body: unknown): Parameters<typeof POST>[0] => {
	const controller = new AbortController();
	controller.abort();
	return {
		request: new Request('http://localhost/api/meechie-studio-text', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(body),
			signal: controller.signal
		}),
		getClientAddress: () => '203.0.113.10'
	} as Parameters<typeof POST>[0];
};

const validPayload = {
	actionId: 'generate',
	modeId: 'test-mode',
	modeLabel: 'Test Mode',
	themeLabel: 'Test Theme',
	evidence: 'He showed up late again and never apologized',
	voice: {
		intensity: 'receipts_out',
		rawness: 'mild',
		thirdPerson: 'sometimes'
	}
};

const buildEventWithController = (
	body: unknown,
	controller: AbortController
): Parameters<typeof POST>[0] =>
	({
		request: new Request('http://localhost/api/meechie-studio-text', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(body),
			signal: controller.signal
		}),
		getClientAddress: () => '203.0.113.10'
	}) as Parameters<typeof POST>[0];

describe('/api/meechie-studio-text', () => {
	it('rejects an already-aborted request with MEECHIE_STUDIO_TEXT_ABORTED before parsing the body', async () => {
		const response = await POST(buildAbortedEvent({ invalid: 'payload' }));
		const payload = await response.json();

		expect(response.status).toBe(499);
		expect(payload.ok).toBe(false);
		expect(payload.error.code).toBe('MEECHIE_STUDIO_TEXT_ABORTED');
	});

	it('does not consume rate-limit quota for already-aborted requests', async () => {
		for (let i = 0; i < 25; i += 1) {
			const response = await POST(buildAbortedEvent({ invalid: 'payload' }));
			expect(response.status).toBe(499);
			const payload = await response.json();
			expect(payload.error.code).toBe('MEECHIE_STUDIO_TEXT_ABORTED');
		}
	});

	it('rejects a request that aborts while the body is being parsed before consuming rate-limit quota', async () => {
		const providerSpy = vi.spyOn(providerAdapterModule.providerAdapter, 'createChatCompletion');
		const controller = new AbortController();
		lateAbortRef.controller = controller;

		try {
			const response = await POST(
				buildEventWithController(validPayload, controller)
			);
			const payload = await response.json();

			expect(response.status).toBe(499);
			expect(payload.ok).toBe(false);
			expect(payload.error.code).toBe('MEECHIE_STUDIO_TEXT_ABORTED');
			expect(providerSpy).not.toHaveBeenCalled();
		} finally {
			providerSpy.mockRestore();
			lateAbortRef.controller = null;
		}
	});

	it('does not consume rate-limit quota when aborting while the body is being parsed', async () => {
		const providerSpy = vi.spyOn(providerAdapterModule.providerAdapter, 'createChatCompletion');

		try {
			for (let i = 0; i < 25; i += 1) {
				const controller = new AbortController();
				lateAbortRef.controller = controller;
				const response = await POST(
					buildEventWithController(validPayload, controller)
				);
				expect(response.status).toBe(499);
				const payload = await response.json();
				expect(payload.error.code).toBe('MEECHIE_STUDIO_TEXT_ABORTED');
			}
			expect(providerSpy).not.toHaveBeenCalled();
		} finally {
			providerSpy.mockRestore();
			lateAbortRef.controller = null;
		}
	});

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

	it('rejects with MEECHIE_STUDIO_TEXT_CONFIG_ERROR without consuming rate-limit quota when XAI_API_KEY is missing', async () => {
		envRef.XAI_API_KEY = undefined;
		const providerSpy = vi.spyOn(providerAdapterModule.providerAdapter, 'createChatCompletion');

		try {
			const response = await POST(buildEvent(validPayload));
			const payload = await response.json();

			expect(response.status).toBe(503);
			expect(payload.ok).toBe(false);
			expect(payload.error.code).toBe('MEECHIE_STUDIO_TEXT_CONFIG_ERROR');
			expect(providerSpy).not.toHaveBeenCalled();
		} finally {
			providerSpy.mockRestore();
			envRef.XAI_API_KEY = 'test-key';
		}
	});
});
