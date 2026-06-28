// Purpose: Verify /api/chat-interpretation endpoint orchestration and validation behavior.
// Why: Keep chat interpretation transport thin while preserving contract-safe responses.
// Info flow: Request payload -> endpoint -> chat pipeline -> JSON response.
import { afterEach, describe, expect, it, vi } from 'vitest';
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

let clientAddressCounter = 0;
const nextClientAddress = () => `198.51.100.${++clientAddressCounter}`;

const buildEvent = (
	body: unknown,
	clientAddress: string = nextClientAddress()
): Parameters<typeof POST>[0] =>
	({
		request: new Request('http://localhost/api/chat-interpretation', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(body)
		}),
		getClientAddress: () => clientAddress
	}) as Parameters<typeof POST>[0];

const buildRawEvent = (
	rawBody: string,
	clientAddress: string = nextClientAddress()
): Parameters<typeof POST>[0] =>
	({
		request: new Request('http://localhost/api/chat-interpretation', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: rawBody
		}),
		getClientAddress: () => clientAddress
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

	it('returns 429 with RATE_LIMITED once a client exceeds the per-route limit', async () => {
		const clientAddress = '203.0.113.9';
		const body = { message: 'build me a clean printable page' };

		for (let i = 0; i < 10; i++) {
			const response = await POST(buildEvent(body, clientAddress));
			expect(response.status).not.toBe(429);
		}

		const limited = await POST(buildEvent(body, clientAddress));
		const payload = await limited.json();

		expect(limited.status).toBe(429);
		expect(payload.error.code).toBe('RATE_LIMITED');
	});
});
