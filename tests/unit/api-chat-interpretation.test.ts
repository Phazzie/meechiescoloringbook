// Purpose: Verify /api/chat-interpretation endpoint orchestration and validation behavior.
// Why: Keep chat interpretation transport thin while preserving contract-safe responses.
// Info flow: Request payload -> endpoint -> chat pipeline -> JSON response.
import { afterEach, describe, expect, it, vi } from 'vitest';

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

import { POST } from '../../src/routes/api/chat-interpretation/+server';
import { providerAdapter } from '../../src/lib/adapters/provider-adapter.adapter';

const validSpec = {
	title: 'Dream Big',
	items: [
		{ number: 1, label: 'Shine' },
		{ number: 2, label: 'Grow' }
	],
	listMode: 'list',
	alignment: 'left',
	numberAlignment: 'strict',
	listGutter: 'normal',
	whitespaceScale: 50,
	textSize: 'small',
	fontStyle: 'rounded',
	textStrokeWidth: 6,
	colorMode: 'black_and_white_only',
	decorations: 'none',
	illustrations: 'none',
	shading: 'none',
	border: 'plain',
	borderThickness: 8,
	variations: 1,
	outputFormat: 'pdf',
	pageSize: 'US_Letter'
} as const;

const buildEvent = (body: unknown): Parameters<typeof POST>[0] =>
	({
		request: new Request('http://localhost/api/chat-interpretation', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(body)
		}),
		getClientAddress: () => '203.0.113.10'
	}) as Parameters<typeof POST>[0];

const buildRawEvent = (rawBody: string): Parameters<typeof POST>[0] =>
	({
		request: new Request('http://localhost/api/chat-interpretation', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: rawBody
		}),
		getClientAddress: () => '203.0.113.10'
	}) as Parameters<typeof POST>[0];

const buildAbortedEvent = (body: unknown): Parameters<typeof POST>[0] => {
	const controller = new AbortController();
	controller.abort();
	return {
		request: new Request('http://localhost/api/chat-interpretation', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(body),
			signal: controller.signal
		}),
		getClientAddress: () => '203.0.113.10'
	} as Parameters<typeof POST>[0];
};

const buildEventWithController = (
	body: unknown,
	controller: AbortController
): Parameters<typeof POST>[0] =>
	({
		request: new Request('http://localhost/api/chat-interpretation', {
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

describe('/api/chat-interpretation', () => {
	it('rejects malformed JSON with INVALID_JSON code', async () => {
		const providerSpy = vi.spyOn(providerAdapter, 'createChatCompletion');
		const response = await POST(buildRawEvent('{not: valid json}'));
		const payload = await response.json();

		expect(response.status).toBe(400);
		expect(payload.ok).toBe(false);
		expect(payload.error.code).toBe('INVALID_JSON');
		expect(providerSpy).not.toHaveBeenCalled();
	});

	it('rejects invalid payloads before calling provider adapter', async () => {
		const providerSpy = vi.spyOn(providerAdapter, 'createChatCompletion');
		const response = await POST(buildEvent({ message: '' }));
		const payload = await response.json();

		expect(response.status).toBe(400);
		expect(payload.ok).toBe(false);
		expect(payload.error.code).toBe('CHAT_INPUT_INVALID');
		expect(providerSpy).not.toHaveBeenCalled();
	});

	it('does not consume rate-limit quota for schema-invalid payloads', async () => {
		const providerSpy = vi.spyOn(providerAdapter, 'createChatCompletion');

		for (let i = 0; i < 25; i += 1) {
			const response = await POST(buildEvent({ message: '' }));
			expect(response.status).toBe(400);
			const payload = await response.json();
			expect(payload.error.code).toBe('CHAT_INPUT_INVALID');
		}
		expect(providerSpy).not.toHaveBeenCalled();
	});

	it('rejects a message over the max chat length with CHAT_INPUT_INVALID', async () => {
		const providerSpy = vi.spyOn(providerAdapter, 'createChatCompletion');
		const response = await POST(buildEvent({ message: 'a'.repeat(4001) }));
		const payload = await response.json();

		expect(response.status).toBe(400);
		expect(payload.ok).toBe(false);
		expect(payload.error.code).toBe('CHAT_INPUT_INVALID');
		expect(providerSpy).not.toHaveBeenCalled();
	});

	it('rejects an already-aborted request with CHAT_ABORTED before parsing the body', async () => {
		const providerSpy = vi.spyOn(providerAdapter, 'createChatCompletion');
		const response = await POST(buildAbortedEvent({ message: 'build me a page' }));
		const payload = await response.json();

		expect(response.status).toBe(499);
		expect(payload.ok).toBe(false);
		expect(payload.error.code).toBe('CHAT_ABORTED');
		expect(providerSpy).not.toHaveBeenCalled();
	});

	it('does not consume rate-limit quota for already-aborted requests', async () => {
		for (let i = 0; i < 25; i += 1) {
			const response = await POST(buildAbortedEvent({ message: 'build me a page' }));
			expect(response.status).toBe(499);
			const payload = await response.json();
			expect(payload.error.code).toBe('CHAT_ABORTED');
		}
	});

	it('rejects a request that aborts while the body is being parsed before consuming rate-limit quota', async () => {
		const providerSpy = vi.spyOn(providerAdapter, 'createChatCompletion');
		const controller = new AbortController();
		lateAbortRef.controller = controller;

		try {
			const response = await POST(
				buildEventWithController({ message: 'build me a page' }, controller)
			);
			const payload = await response.json();

			expect(response.status).toBe(499);
			expect(payload.ok).toBe(false);
			expect(payload.error.code).toBe('CHAT_ABORTED');
			expect(providerSpy).not.toHaveBeenCalled();
		} finally {
			lateAbortRef.controller = null;
		}
	});

	it('does not consume rate-limit quota when aborting while the body is being parsed', async () => {
		const providerSpy = vi.spyOn(providerAdapter, 'createChatCompletion');

		try {
			for (let i = 0; i < 25; i += 1) {
				const controller = new AbortController();
				lateAbortRef.controller = controller;
				const response = await POST(
					buildEventWithController({ message: 'build me a page' }, controller)
				);
				expect(response.status).toBe(499);
				const payload = await response.json();
				expect(payload.error.code).toBe('CHAT_ABORTED');
			}
			expect(providerSpy).not.toHaveBeenCalled();
		} finally {
			lateAbortRef.controller = null;
		}
	});

	it('returns structured spec when provider returns valid JSON content', async () => {
		vi.spyOn(providerAdapter, 'createChatCompletion').mockResolvedValue({
			ok: true,
			value: {
				model: 'grok-4-1-fast-reasoning',
				content: JSON.stringify(validSpec)
			}
		});

		const response = await POST(
			buildEvent({ message: 'build me a clean printable page' })
		);
		const payload = await response.json();

		expect(response.status).toBe(200);
		expect(payload.ok).toBe(true);
		expect(payload.value.spec).toEqual(validSpec);
	});

	it('rejects with CHAT_CONFIG_ERROR without consuming rate-limit quota when XAI_API_KEY is missing', async () => {
		envRef.XAI_API_KEY = undefined;
		const providerSpy = vi.spyOn(providerAdapter, 'createChatCompletion');

		try {
			const response = await POST(buildEvent({ message: 'build me a page' }));
			const payload = await response.json();

			expect(response.status).toBe(503);
			expect(payload.ok).toBe(false);
			expect(payload.error.code).toBe('CHAT_CONFIG_ERROR');
			expect(providerSpy).not.toHaveBeenCalled();
		} finally {
			envRef.XAI_API_KEY = 'test-key';
		}
	});
});
