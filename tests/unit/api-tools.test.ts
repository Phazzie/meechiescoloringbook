// Purpose: Verify /api/tools endpoint validation, safety, and rate-limit gating.
// Why: Meechie tool requests must stay contract-safe, refuse disallowed content, and never reach a provider unmetered.
// Info flow: Request payload -> endpoint -> quota gate -> safety + adapter result.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('$lib/server/rate-limit-route', () => ({
	createQuotaGate: vi.fn()
}));

import {
	createQuotaGate,
	type QuotaDecision
} from '$lib/server/rate-limit-route';
import { POST } from '../../src/routes/api/tools/+server';
import { meechieToolAdapter } from '../../src/lib/adapters/meechie-tool-seam';

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

const CLIENT_ADDRESS = '203.0.113.7';

// Header values are fixtures owned by the guard; the route must echo them, never recompute them.
const ALLOW_HEADERS: Record<string, string> = {
	'Cache-Control': 'no-store',
	'RateLimit-Limit': '20',
	'RateLimit-Remaining': '19',
	'RateLimit-Reset': '47'
};

const DENY_HEADERS: Record<string, string> = {
	'Cache-Control': 'no-store',
	'RateLimit-Limit': '20',
	'RateLimit-Remaining': '0',
	'RateLimit-Reset': '37',
	'Retry-After': '37'
};

const UNAVAILABLE_HEADERS: Record<string, string> = {
	'Cache-Control': 'no-store'
};

const ALLOWED_DECISION: QuotaDecision = { ok: true, headers: ALLOW_HEADERS };

const DENIED_BODY = {
	ok: false as const,
	error: {
		code: 'RATE_LIMITED' as const,
		message: 'Too many requests. Try again after the current window resets.'
	}
};

const DENIED_DECISION: QuotaDecision = {
	ok: false,
	status: 429,
	headers: DENY_HEADERS,
	body: DENIED_BODY
};

const UNAVAILABLE_DECISION: QuotaDecision = {
	ok: false,
	status: 503,
	headers: UNAVAILABLE_HEADERS,
	body: {
		ok: false,
		error: {
			code: 'RATE_LIMIT_UNAVAILABLE',
			message: 'Rate limiting is temporarily unavailable.'
		}
	}
};

/** Installs a gate the route will build, and hands back the spy so tests can assert the charge. */
const stubGate = (decision: QuotaDecision) => {
	const gate = vi.fn(async (_cost: number): Promise<QuotaDecision> => decision);
	vi.mocked(createQuotaGate).mockReturnValue(gate);
	return gate;
};

const buildEvent = (
	body: unknown,
	getClientAddress: () => string = () => CLIENT_ADDRESS
): Parameters<typeof POST>[0] =>
	({
		getClientAddress,
		request: new Request('http://localhost/api/tools', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(body)
		})
	}) as Parameters<typeof POST>[0];

const buildRawEvent = (rawBody: string): Parameters<typeof POST>[0] =>
	({
		getClientAddress: () => CLIENT_ADDRESS,
		request: new Request('http://localhost/api/tools', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: rawBody
		})
	}) as Parameters<typeof POST>[0];

/** A request whose body read is aborted mid-flight, before any billable work can start. */
const buildAbortedEvent = (): Parameters<typeof POST>[0] => {
	const abortError = Object.assign(new Error('The operation was aborted.'), {
		name: 'AbortError'
	});
	return {
		getClientAddress: () => CLIENT_ADDRESS,
		request: {
			json: async () => {
				throw abortError;
			}
		}
	} as unknown as Parameters<typeof POST>[0];
};

beforeEach(() => {
	vi.mocked(createQuotaGate).mockReset();
	stubGate(ALLOWED_DECISION);
});

afterEach(() => {
	vi.restoreAllMocks();
});

describe('/api/tools', () => {
	it('rejects malformed JSON with INVALID_JSON code', async () => {
		const gate = stubGate(ALLOWED_DECISION);
		const adapterSpy = vi.spyOn(meechieToolAdapter, 'respond');
		const response = await POST(buildRawEvent('{not: valid json}'));
		const payload = await response.json();

		expect(response.status).toBe(400);
		expect(payload.ok).toBe(false);
		expect(payload.error.code).toBe('INVALID_JSON');
		expect(adapterSpy).not.toHaveBeenCalled();
		expect(gate).not.toHaveBeenCalled();
	});

	it('rejects invalid tool input without consulting the quota gate', async () => {
		const gate = stubGate(ALLOWED_DECISION);
		const adapterSpy = vi.spyOn(meechieToolAdapter, 'respond');
		const response = await POST(buildEvent({ toolId: 'nonexistent_tool' }));
		const payload = await response.json();

		expect(response.status).toBe(400);
		expect(payload.ok).toBe(false);
		expect(payload.error.code).toBe('MEECHIE_TOOL_INPUT_INVALID');
		expect(adapterSpy).not.toHaveBeenCalled();
		expect(gate).not.toHaveBeenCalled();
	});

	it('rejects disallowed content and does not invoke adapter or charge quota', async () => {
		const gate = stubGate(ALLOWED_DECISION);
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
		expect(gate).not.toHaveBeenCalled();
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

	it('charges the text bucket once and echoes the allowed headers', async () => {
		const gate = stubGate(ALLOWED_DECISION);
		vi.spyOn(meechieToolAdapter, 'respond').mockResolvedValue({
			ok: true,
			value: {
				toolId: 'apology_translator',
				headline: 'Decoded',
				response: 'That apology was weak.'
			}
		});

		const event = buildEvent({
			toolId: 'apology_translator',
			apology: "I'm sorry you feel that way."
		});
		const response = await POST(event);

		expect(response.status).toBe(200);
		expect(gate).toHaveBeenCalledTimes(1);
		expect(gate).toHaveBeenCalledWith(1);
		expect(createQuotaGate).toHaveBeenCalledWith(event, 'text');
		for (const [name, value] of Object.entries(ALLOW_HEADERS)) {
			expect(response.headers.get(name)).toBe(value);
		}
	});

	it('returns the gate denial verbatim and makes zero provider calls', async () => {
		const gate = stubGate(DENIED_DECISION);
		const adapterSpy = vi
			.spyOn(meechieToolAdapter, 'respond')
			.mockResolvedValue({
				ok: true,
				value: {
					toolId: 'apology_translator',
					headline: 'Decoded',
					response: 'Should never be reached.'
				}
			});

		const response = await POST(
			buildEvent({
				toolId: 'apology_translator',
				apology: "I'm sorry you feel that way."
			})
		);
		const payload = await response.json();

		expect(response.status).toBe(429);
		expect(response.headers.get('Retry-After')).toBe('37');
		for (const [name, value] of Object.entries(DENY_HEADERS)) {
			expect(response.headers.get(name)).toBe(value);
		}
		expect(payload).toEqual(DENIED_BODY);
		expect(gate).toHaveBeenCalledTimes(1);
		expect(adapterSpy).not.toHaveBeenCalled();
	});

	it('returns 503 and makes zero provider calls when the limiter is unavailable', async () => {
		const gate = stubGate(UNAVAILABLE_DECISION);
		const adapterSpy = vi
			.spyOn(meechieToolAdapter, 'respond')
			.mockResolvedValue({
				ok: true,
				value: {
					toolId: 'random_meechie',
					headline: 'Random Meechie',
					response: 'Should never be reached.'
				}
			});

		const response = await POST(buildEvent({ toolId: 'random_meechie' }));
		const payload = await response.json();

		expect(response.status).toBe(503);
		expect(response.headers.get('Cache-Control')).toBe('no-store');
		expect(response.headers.get('Retry-After')).toBeNull();
		expect(payload.ok).toBe(false);
		expect(payload.error.code).toBe('RATE_LIMIT_UNAVAILABLE');
		expect(gate).toHaveBeenCalledTimes(1);
		expect(adapterSpy).not.toHaveBeenCalled();
	});

	it('charges nothing when the request is aborted before the body is read', async () => {
		const gate = stubGate(ALLOWED_DECISION);
		const adapterSpy = vi.spyOn(meechieToolAdapter, 'respond');

		await expect(POST(buildAbortedEvent())).rejects.toThrow(
			'The operation was aborted.'
		);

		expect(gate).not.toHaveBeenCalled();
		expect(adapterSpy).not.toHaveBeenCalled();
	});

	it('returns a failure status without serializing upstream provider diagnostics', async () => {
		const gate = stubGate(ALLOWED_DECISION);
		vi.spyOn(meechieToolAdapter, 'respond').mockResolvedValue({
			ok: false,
			error: {
				code: 'MEECHIE_TOOL_PROVIDER_ERROR',
				message: providerLeakCanary,
				details: {
					body: providerLeakCanary,
					accountId: 'acct-canary',
					teamId: 'team-canary'
				}
			}
		});

		const response = await POST(buildEvent({ toolId: 'random_meechie' }));
		const payload = await response.json();

		expect(response.status).toBe(502);
		expect(payload.ok).toBe(false);
		expect(payload.error.code).toBe('MEECHIE_TOOL_PROVIDER_ERROR');
		expectProviderLeakCanaryRedacted(payload);
		// The provider call was attempted, so the charge stands.
		expect(gate).toHaveBeenCalledTimes(1);
	});
});
