// Purpose: Verify /api/tools endpoint validation and safety behavior.
// Why: Keep Meechie tool requests contract-safe and blocked on disallowed content.
// Info flow: Request payload -> endpoint -> safety + adapter result.
import { afterEach, describe, expect, it, vi } from 'vitest';
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

const buildEvent = (body: unknown): Parameters<typeof POST>[0] =>
	({
		request: new Request('http://localhost/api/tools', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(body)
		})
	}) as Parameters<typeof POST>[0];

const buildRawEvent = (rawBody: string): Parameters<typeof POST>[0] =>
	({
		request: new Request('http://localhost/api/tools', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: rawBody
		})
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

	it('returns a failure status without serializing upstream provider diagnostics', async () => {
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
	});
});
