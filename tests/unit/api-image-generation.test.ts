// Purpose: Verify /api/image-generation input validation and API-key forwarding behavior.
// Why: Ensure local API-key workflow surfaces actionable errors while backend work is in progress.
// Info flow: Request payload + headers -> endpoint -> contract-shaped result.
import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('../../src/lib/adapters/provider-adapter.adapter', () => ({
	createProviderAdapter: vi.fn()
}));

import { createProviderAdapter } from '../../src/lib/adapters/provider-adapter.adapter';
import { POST } from '../../src/routes/api/image-generation/+server';

const mockCreateProviderAdapter = vi.mocked(createProviderAdapter);

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

const validPrompt = [
	'Black-and-white coloring book page',
	'outline-only',
	'easy to color',
	'Crisp vector-like linework',
	'NEGATIVE PROMPT:',
	'US Letter 8.5x11 portrait.'
].join(' ');

const buildEvent = (body: unknown, headers?: Record<string, string>) =>
	({
		request: new Request('http://localhost/api/image-generation', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				...(headers ?? {})
			},
			body: JSON.stringify(body)
		})
	}) as Parameters<typeof POST>[0];

describe('/api/image-generation', () => {
	beforeEach(() => {
		mockCreateProviderAdapter.mockReset();
	});

	it('rejects invalid payloads', async () => {
		const response = await POST(buildEvent({ spec: {} }));
		const payload = await response.json();
		expect(response.status).toBe(400);
		expect(payload.ok).toBe(false);
		expect(payload.error.code).toBe('IMAGE_INPUT_INVALID');
	});

	it('returns missing-key guidance when provider key is absent', async () => {
		mockCreateProviderAdapter.mockReturnValue({
			createChatCompletion: vi.fn(),
			createImageGeneration: vi.fn(async () => ({
				ok: false as const,
				error: {
					code: 'PROVIDER_API_KEY_MISSING',
					message: 'XAI_API_KEY is required.'
				}
			}))
		});

		const response = await POST(
			buildEvent({
				spec: validSpec,
				prompt: validPrompt,
				variations: 1,
				outputFormat: 'pdf'
			})
		);
		const payload = await response.json();

		expect(response.status).toBe(401);
		expect(payload.ok).toBe(false);
		expect(payload.error.code).toBe('PROVIDER_API_KEY_MISSING');
		expect(payload.error.message).toContain('Add API key in the UI panel');
	});

	it('forwards x-api-key header into provider adapter config', async () => {
		mockCreateProviderAdapter.mockReturnValue({
			createChatCompletion: vi.fn(),
			createImageGeneration: vi.fn(async () => ({
				ok: true as const,
				value: {
					images: [{ b64_json: 'abc123' }],
					revisedPrompt: 'prompt'
				}
			}))
		});

		const response = await POST(
			buildEvent(
				{
					spec: validSpec,
					prompt: validPrompt,
					variations: 1,
					outputFormat: 'pdf'
				},
				{ 'x-api-key': 'test-key-123' }
			)
		);

		expect(response.status).toBe(200);
		expect(mockCreateProviderAdapter).toHaveBeenCalledWith({ apiKey: 'test-key-123' });
	});
});
