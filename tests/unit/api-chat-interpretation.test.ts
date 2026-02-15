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

const buildEvent = (body: unknown): Parameters<typeof POST>[0] =>
	({
		request: new Request('http://localhost/api/chat-interpretation', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(body)
		})
	}) as Parameters<typeof POST>[0];

afterEach(() => {
	vi.restoreAllMocks();
});

describe('/api/chat-interpretation', () => {
	it('rejects invalid payloads before calling provider adapter', async () => {
		const providerSpy = vi.spyOn(providerAdapter, 'createChatCompletion');
		const response = await POST(buildEvent({ message: '' }));
		const payload = await response.json();

		expect(response.status).toBe(200);
		expect(payload.ok).toBe(false);
		expect(payload.error.code).toBe('CHAT_INPUT_INVALID');
		expect(providerSpy).not.toHaveBeenCalled();
	});

	it('returns structured spec when provider returns valid JSON content', async () => {
		vi.spyOn(providerAdapter, 'createChatCompletion').mockResolvedValue({
			ok: true,
			value: {
				model: 'grok-4-1-fast-reasoning',
				content: `Here is the spec:\n${JSON.stringify(validSpec)}`
			}
		});

		const response = await POST(buildEvent({ message: 'build me a clean printable page' }));
		const payload = await response.json();

		expect(response.status).toBe(200);
		expect(payload.ok).toBe(true);
		expect(payload.value.spec).toEqual(validSpec);
	});
});
