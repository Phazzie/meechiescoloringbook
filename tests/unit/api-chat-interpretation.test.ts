// Purpose: Verify /api/chat-interpretation endpoint orchestration and validation behavior.
// Why: Keep chat interpretation transport thin while preserving contract-safe responses.
// Info flow: Request payload -> endpoint -> chat pipeline -> JSON response.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { POST } from '../../src/routes/api/chat-interpretation/+server';
import { providerAdapter } from '../../src/lib/adapters/provider-adapter.adapter';
import { TEXT_MODEL } from '../../src/lib/core/models';

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

const buildEvent = (body: unknown): Parameters<typeof POST>[0] =>
	({
		request: new Request('http://localhost/api/chat-interpretation', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(body)
		})
	}) as Parameters<typeof POST>[0];

const buildRawEvent = (rawBody: string): Parameters<typeof POST>[0] =>
	({
		request: new Request('http://localhost/api/chat-interpretation', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: rawBody
		})
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

	it('returns structured spec when provider returns valid JSON content', async () => {
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
		expect(providerSpy).toHaveBeenCalledWith(
			expect.objectContaining({ model: TEXT_MODEL })
		);
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
	});
});
