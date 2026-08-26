// Purpose: Verify /api/meechie-studio-text parsing and public provider-error safety.
// Why: Ensure malformed input is blocked and upstream diagnostics never cross the route boundary.
// Info flow: Raw request -> parse guard/provider pipeline -> contract-safe JSON response.
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('$lib/adapters/provider-adapter.adapter', () => ({
	createProviderAdapter: vi.fn()
}));

import { createProviderAdapter } from '$lib/adapters/provider-adapter.adapter';
import { POST } from '../../src/routes/api/meechie-studio-text/+server';

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
		request: new Request('http://localhost/api/meechie-studio-text', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: rawBody
		})
	}) as Parameters<typeof POST>[0];

const buildEvent = (body: unknown): Parameters<typeof POST>[0] =>
	({
		request: new Request('http://localhost/api/meechie-studio-text', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(body)
		})
	}) as Parameters<typeof POST>[0];

describe('/api/meechie-studio-text', () => {
	beforeEach(() => {
		vi.mocked(createProviderAdapter).mockReset();
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
		});

		const response = await POST(buildEvent(validInput));
		const payload = await response.json();

		expect(response.status).toBe(502);
		expect(payload.ok).toBe(false);
		expect(payload.error.code).toBe('PROVIDER_HTTP_ERROR');
		expectProviderLeakCanaryRedacted(payload);
	});
});
