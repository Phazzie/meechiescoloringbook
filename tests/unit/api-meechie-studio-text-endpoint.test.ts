// Purpose: Verify /api/meechie-studio-text parsing, quota enforcement, and public provider-error safety.
// Why: Ensure malformed input is blocked, no billable call escapes the rate-limit gate, and upstream diagnostics never cross the route boundary.
// Info flow: Raw request -> parse guard/quota gate/provider pipeline -> contract-safe JSON response.
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('$lib/adapters/provider-adapter.adapter', () => ({
	createProviderAdapter: vi.fn()
}));

vi.mock('$lib/server/rate-limit-route', () => ({
	createQuotaGate: vi.fn()
}));

import { createProviderAdapter } from '$lib/adapters/provider-adapter.adapter';
import {
	createQuotaGate,
	type QuotaDecision
} from '$lib/server/rate-limit-route';
import { POST } from '../../src/routes/api/meechie-studio-text/+server';

const CLIENT_ADDRESS = '203.0.113.7';

// Studio text is charged the worst case up front: one request can make two provider
// calls because of the pipeline's bounded correction retry.
const STUDIO_TEXT_COST = 2;

const ALLOWED_HEADERS = {
	'Cache-Control': 'no-store',
	'RateLimit-Limit': '20',
	'RateLimit-Remaining': '17',
	'RateLimit-Reset': '42'
} as const;

const DENIED_HEADERS = {
	'Cache-Control': 'no-store',
	'RateLimit-Limit': '20',
	'RateLimit-Remaining': '0',
	'RateLimit-Reset': '30',
	'Retry-After': '30'
} as const;

const ALLOWED: QuotaDecision = { ok: true, headers: { ...ALLOWED_HEADERS } };

const DENIED: QuotaDecision = {
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

const UNAVAILABLE: QuotaDecision = {
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
	const consume = vi.fn(async (_cost: number) => decision);
	vi.mocked(createQuotaGate).mockImplementation(() => consume);
	return consume;
};

const validStudioText = JSON.stringify({
	verdict: 'Guilty',
	quote: 'No way',
	pageTitle: 'Uh oh',
	pageItems: [
		{ number: 1, label: 'One' },
		{ number: 2, label: 'Two' }
	],
	qualityState: 'ready'
});

/** Provider double whose chat spy proves whether any billable call was made. */
const installProvider = (
	contents: string[] = [validStudioText]
): ReturnType<typeof vi.fn> => {
	let callIndex = 0;
	const createChatCompletion = vi.fn(async () => {
		const content = contents[Math.min(callIndex, contents.length - 1)];
		callIndex++;
		return { ok: true as const, value: { model: 'test-model', content } };
	});
	vi.mocked(createProviderAdapter).mockReturnValue({
		createChatCompletion,
		createImageGeneration: vi.fn()
	} as unknown as ReturnType<typeof createProviderAdapter>);
	return createChatCompletion;
};

const providerLeakCanary =
	'RAW_PROVIDER_BODY https://api.x.ai/v1/responses?key=xai-secret-canary 550e8400-e29b-41d4-a716-446655440000 account=acct-canary team=team-canary';

const expectProviderLeakCanaryRedacted = (payload: unknown): void => {
	const serialized = JSON.stringify(payload);
	expect(serialized).not.toContain('RAW_PROVIDER_BODY');
	expect(serialized).not.toContain(
		'https://api.x.ai/v1/responses?key=xai-secret-canary'
	);
	expect(serialized).not.toContain('xai-secret-canary');
	expect(serialized).not.toContain('550e8400-e29b-41d4-a716-446655440000');
	expect(serialized).not.toContain('acct-canary');
	expect(serialized).not.toContain('team-canary');
};

const validInput = {
	actionId: 'generate',
	modeId: 'relationship',
	modeLabel: 'Relationship',
	themeLabel: 'Receipts',
	evidence: 'He said one thing and did another.',
	voice: {
		intensity: 'receipts_out',
		rawness: 'medium',
		thirdPerson: 'sometimes'
	}
} as const;

const buildRawEvent = (rawBody: string): Parameters<typeof POST>[0] =>
	({
		getClientAddress: () => CLIENT_ADDRESS,
		request: new Request('http://localhost/api/meechie-studio-text', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: rawBody
		})
	}) as Parameters<typeof POST>[0];

const buildEvent = (body: unknown): Parameters<typeof POST>[0] =>
	buildRawEvent(JSON.stringify(body));

describe('/api/meechie-studio-text', () => {
	beforeEach(() => {
		vi.mocked(createProviderAdapter).mockReset();
		vi.mocked(createQuotaGate).mockReset();
		installGate(ALLOWED);
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

	it('does not serialize upstream provider diagnostics', async () => {
		vi.mocked(createProviderAdapter).mockReturnValue({
			createChatCompletion: vi.fn(async () => ({
				ok: false as const,
				error: {
					code: 'PROVIDER_HTTP_ERROR',
					message: providerLeakCanary,
					details: {
						body: providerLeakCanary,
						accountId: 'acct-canary',
						teamId: 'team-canary'
					}
				}
			})),
			createImageGeneration: vi.fn()
		} as unknown as ReturnType<typeof createProviderAdapter>);

		const response = await POST(buildEvent(validInput));
		const payload = await response.json();

		expect(response.status).toBe(502);
		expect(payload.ok).toBe(false);
		expect(payload.error.code).toBe('PROVIDER_HTTP_ERROR');
		expectProviderLeakCanaryRedacted(payload);
	});

	it('builds a text-bucket gate from the route event and charges the retry worst case once', async () => {
		const consume = installGate(ALLOWED);
		const chat = installProvider();

		const response = await POST(buildEvent(validInput));

		expect(response.status).toBe(200);
		expect(vi.mocked(createQuotaGate)).toHaveBeenCalledTimes(1);
		const [passedEvent, bucket] = vi.mocked(createQuotaGate).mock.calls[0];
		// The route must hand the gate its own event so the guard meters per caller.
		expect(passedEvent.getClientAddress()).toBe(CLIENT_ADDRESS);
		expect(bucket).toBe('text');
		expect(consume.mock.calls).toEqual([[STUDIO_TEXT_COST]]);
		expect(chat).toHaveBeenCalledTimes(1);
	});

	it('advertises the gate headers on a successful response', async () => {
		installGate(ALLOWED);
		installProvider();

		const response = await POST(buildEvent(validInput));

		expect(response.status).toBe(200);
		for (const [name, value] of Object.entries(ALLOWED_HEADERS)) {
			expect(response.headers.get(name)).toBe(value);
		}
	});

	it('returns the gate 429 with Retry-After and makes zero provider calls when quota is exhausted', async () => {
		const consume = installGate(DENIED);
		const chat = installProvider();

		const response = await POST(buildEvent(validInput));
		const payload = await response.json();

		expect(response.status).toBe(429);
		expect(payload).toEqual(DENIED.ok === false ? DENIED.body : null);
		// Headers come from the store's own reset instant; the route must not recompute them.
		for (const [name, value] of Object.entries(DENIED_HEADERS)) {
			expect(response.headers.get(name)).toBe(value);
		}
		expect(response.headers.get('Retry-After')).toBe('30');
		expect(consume.mock.calls).toEqual([[STUDIO_TEXT_COST]]);
		expect(chat).not.toHaveBeenCalled();
	});

	it('returns the gate 503 and makes zero provider calls when the limiter is unavailable', async () => {
		installGate(UNAVAILABLE);
		const chat = installProvider();

		const response = await POST(buildEvent(validInput));
		const payload = await response.json();

		expect(response.status).toBe(503);
		expect(payload).toEqual(UNAVAILABLE.ok === false ? UNAVAILABLE.body : null);
		expect(response.headers.get('Cache-Control')).toBe('no-store');
		expect(response.headers.get('Retry-After')).toBeNull();
		expect(chat).not.toHaveBeenCalled();
	});

	it('never consults the gate for input the route can reject locally', async () => {
		const consume = installGate(ALLOWED);
		const chat = installProvider();

		const malformed = await POST(buildRawEvent('{not: valid json}'));
		const schemaInvalid = await POST(buildEvent({ invalid: 'payload' }));
		const disallowed = await POST(
			buildEvent({ ...validInput, evidence: 'evidence mentioning minors' })
		);

		expect(malformed.status).toBe(400);
		expect(schemaInvalid.status).toBe(400);
		expect(disallowed.status).toBe(400);
		expect(consume).not.toHaveBeenCalled();
		expect(chat).not.toHaveBeenCalled();
	});

	it('never charges when the request is aborted before its body can be read', async () => {
		const consume = installGate(ALLOWED);
		const chat = installProvider();
		const abortedEvent = {
			getClientAddress: () => CLIENT_ADDRESS,
			request: {
				json: async () => {
					throw new DOMException('The operation was aborted.', 'AbortError');
				}
			}
		} as unknown as Parameters<typeof POST>[0];

		await expect(POST(abortedEvent)).rejects.toThrow(/aborted/i);

		expect(consume).not.toHaveBeenCalled();
		expect(chat).not.toHaveBeenCalled();
	});
});
