// Purpose: Verify /api/chat-interpretation endpoint orchestration, validation, and rate-limit charging.
// Why: Keep chat interpretation transport thin, contract-safe, and unable to reach the provider unmetered.
// Info flow: Request payload -> endpoint -> quota gate -> chat pipeline -> JSON response.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Hoisted so the route's own `createQuotaGate` import resolves to this double; the real gate builds
// a guard and a store per request, which a unit test has no business exercising.
const { createQuotaGate } = vi.hoisted(() => ({ createQuotaGate: vi.fn() }));
vi.mock('$lib/server/rate-limit-route', () => ({ createQuotaGate }));

import { POST } from '../../src/routes/api/chat-interpretation/+server';
import { providerAdapter } from '../../src/lib/adapters/provider-adapter.adapter';
import { TEXT_MODEL } from '../../src/lib/core/models';
import type { QuotaDecision } from '../../src/lib/server/rate-limit-route';

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

const CLIENT_ADDRESS = '203.0.113.7';

// Exactly what the guard derives from the store's reset; the route must not recompute any of it.
const ALLOWED_HEADERS = {
	'Cache-Control': 'no-store',
	'RateLimit-Limit': '20',
	'RateLimit-Remaining': '19',
	'RateLimit-Reset': '41'
} as const;

const DENIED_HEADERS = {
	'Cache-Control': 'no-store',
	'RateLimit-Limit': '20',
	'RateLimit-Remaining': '0',
	'RateLimit-Reset': '37',
	'Retry-After': '37'
} as const;

const allowedDecision: QuotaDecision = {
	ok: true,
	headers: { ...ALLOWED_HEADERS }
};

const deniedDecision: QuotaDecision = {
	ok: false,
	status: 429,
	headers: { ...DENIED_HEADERS },
	body: {
		ok: false,
		error: {
			code: 'RATE_LIMITED',
			message: 'Too many requests. Try again after the current window resets.'
		}
	}
};

const unavailableDecision: QuotaDecision = {
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
};

/** Installs the gate the route will build, and hands back the spy that records each charge. */
const installGate = (decision: QuotaDecision) => {
	const gate = vi.fn(async (_cost: number): Promise<QuotaDecision> => decision);
	createQuotaGate.mockReturnValue(gate);
	return gate;
};

const providerLeakCanary =
	'RAW_PROVIDER_BODY https://api.x.ai/v1/chat?key=xai-secret-canary 550e8400-e29b-41d4-a716-446655440000 account=acct-canary team=team-canary';

const expectProviderLeakCanaryRedacted = (payload: unknown): void => {
	const serialized = JSON.stringify(payload);
	for (const token of [
		'RAW_PROVIDER_BODY',
		'https://api.x.ai/v1/chat?key=xai-secret-canary',
		'xai-secret-canary',
		'550e8400-e29b-41d4-a716-446655440000',
		'acct-canary',
		'team-canary'
	]) {
		expect(serialized).not.toContain(token);
	}
};

const buildRequest = (rawBody: string, signal?: AbortSignal): Request =>
	new Request('http://localhost/api/chat-interpretation', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: rawBody,
		...(signal ? { signal } : {})
	});

const buildRawEvent = (
	rawBody: string,
	signal?: AbortSignal
): Parameters<typeof POST>[0] =>
	({
		request: buildRequest(rawBody, signal),
		getClientAddress: () => CLIENT_ADDRESS
	}) as Parameters<typeof POST>[0];

const buildEvent = (
	body: unknown,
	signal?: AbortSignal
): Parameters<typeof POST>[0] => buildRawEvent(JSON.stringify(body), signal);

const abortedSignal = (): AbortSignal => {
	const controller = new AbortController();
	controller.abort();
	return controller.signal;
};

beforeEach(() => {
	createQuotaGate.mockReset();
	installGate(allowedDecision);
});

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
		expect(createQuotaGate).not.toHaveBeenCalled();
	});

	it('rejects invalid payloads before calling provider adapter', async () => {
		const gate = installGate(allowedDecision);
		const providerSpy = vi.spyOn(providerAdapter, 'createChatCompletion');
		const response = await POST(buildEvent({ message: '' }));
		const payload = await response.json();

		expect(response.status).toBe(400);
		expect(payload.ok).toBe(false);
		expect(payload.error.code).toBe('CHAT_INPUT_INVALID');
		expect(providerSpy).not.toHaveBeenCalled();
		// Invalid work is never charged, and a rejection carries no quota headers.
		expect(gate).not.toHaveBeenCalled();
		expect(response.headers.get('RateLimit-Limit')).toBeNull();
	});

	it('returns structured spec when provider returns valid JSON content', async () => {
		const gate = installGate(allowedDecision);
		const providerSpy = vi
			.spyOn(providerAdapter, 'createChatCompletion')
			.mockResolvedValue({
				ok: true,
				value: {
					model: TEXT_MODEL,
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
		expect(providerSpy).toHaveBeenCalledTimes(1);
		expect(providerSpy).toHaveBeenCalledWith(
			expect.objectContaining({ model: TEXT_MODEL })
		);
		expect(gate).toHaveBeenCalledTimes(1);
		expect(gate).toHaveBeenCalledWith(1);
		for (const [name, value] of Object.entries(ALLOWED_HEADERS)) {
			expect(response.headers.get(name)).toBe(value);
		}
	});

	it('builds the gate from the route event on the text bucket', async () => {
		vi.spyOn(providerAdapter, 'createChatCompletion').mockResolvedValue({
			ok: true,
			value: { model: TEXT_MODEL, content: JSON.stringify(validSpec) }
		});

		await POST(buildEvent({ message: 'Make me a page.' }));

		expect(createQuotaGate).toHaveBeenCalledTimes(1);
		const [gateEvent, bucket] = createQuotaGate.mock.calls[0] as [
			{ getClientAddress: () => string },
			string
		];
		expect(bucket).toBe('text');
		// Threading the real event is the whole point: without it every caller shares one bucket.
		expect(gateEvent.getClientAddress()).toBe(CLIENT_ADDRESS);
	});

	it('returns the gate denial without calling the provider', async () => {
		const gate = installGate(deniedDecision);
		const providerSpy = vi
			.spyOn(providerAdapter, 'createChatCompletion')
			.mockResolvedValue({
				ok: true,
				value: { model: TEXT_MODEL, content: JSON.stringify(validSpec) }
			});

		const response = await POST(buildEvent({ message: 'Make me a page.' }));
		const payload = await response.json();

		expect(response.status).toBe(429);
		expect(payload.ok).toBe(false);
		expect(payload.error.code).toBe('RATE_LIMITED');
		expect(providerSpy).not.toHaveBeenCalled();
		expect(gate).toHaveBeenCalledTimes(1);
		// Verbatim, including Retry-After: the guard derived these from the store's own reset.
		for (const [name, value] of Object.entries(DENIED_HEADERS)) {
			expect(response.headers.get(name)).toBe(value);
		}
	});

	it('fails closed with 503 when the gate cannot decide', async () => {
		const gate = installGate(unavailableDecision);
		const providerSpy = vi
			.spyOn(providerAdapter, 'createChatCompletion')
			.mockResolvedValue({
				ok: true,
				value: { model: TEXT_MODEL, content: JSON.stringify(validSpec) }
			});

		const response = await POST(buildEvent({ message: 'Make me a page.' }));
		const payload = await response.json();

		expect(response.status).toBe(503);
		expect(payload.ok).toBe(false);
		expect(payload.error.code).toBe('RATE_LIMIT_UNAVAILABLE');
		expect(response.headers.get('Cache-Control')).toBe('no-store');
		expect(providerSpy).not.toHaveBeenCalled();
		expect(gate).toHaveBeenCalledTimes(1);
	});

	it('charges nothing and calls nothing when the caller has already aborted', async () => {
		const gate = installGate(allowedDecision);
		const providerSpy = vi
			.spyOn(providerAdapter, 'createChatCompletion')
			.mockResolvedValue({
				ok: true,
				value: { model: TEXT_MODEL, content: JSON.stringify(validSpec) }
			});

		const response = await POST(
			buildEvent({ message: 'Make me a page.' }, abortedSignal())
		);
		const payload = await response.json();

		expect(response.status).toBe(499);
		expect(payload.ok).toBe(false);
		expect(payload.error.code).toBe('CHAT_ABORTED');
		expect(gate).not.toHaveBeenCalled();
		expect(providerSpy).not.toHaveBeenCalled();
		expect(response.headers.get('RateLimit-Limit')).toBeNull();
	});

	it('does not serialize upstream provider diagnostics', async () => {
		vi.spyOn(providerAdapter, 'createChatCompletion').mockResolvedValue({
			ok: false,
			error: {
				code: 'PROVIDER_HTTP_ERROR',
				message: providerLeakCanary,
				details: {
					body: providerLeakCanary,
					accountId: 'acct-canary',
					teamId: 'team-canary'
				}
			}
		});

		const response = await POST(buildEvent({ message: 'Make me a page.' }));
		const payload = await response.json();

		expect(response.status).toBe(502);
		expect(payload.error.code).toBe('PROVIDER_HTTP_ERROR');
		expectProviderLeakCanaryRedacted(payload);
		// Post-charge failure still reports the quota the caller just spent.
		expect(response.headers.get('RateLimit-Remaining')).toBe('19');
	});
});
