// Purpose: Verify /api/generate orchestrates prompt, image, and drift flow for the UI.
// Why: Keep the main generation path on one server endpoint with contract-checked output.
// Info flow: Generate request -> endpoint orchestration -> contract response.
import { describe, expect, it, vi } from 'vitest';
import { POST } from '../../src/routes/api/generate/+server';

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

const buildEvent = (
	body: unknown,
	fetchImpl: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>
): Parameters<typeof POST>[0] =>
	({
		request: new Request('http://localhost/api/generate', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(body)
		}),
		fetch: fetchImpl
	}) as Parameters<typeof POST>[0];

describe('/api/generate', () => {
	it('rejects invalid payloads', async () => {
		const fetchMock = vi.fn(async () => new Response('{}', { status: 500 }));
		const response = await POST(buildEvent({ spec: {} }, fetchMock));
		const payload = await response.json();

		expect(response.status).toBe(400);
		expect(payload.ok).toBe(false);
		expect(payload.error.code).toBe('GENERATE_INPUT_INVALID');
		expect(fetchMock).not.toHaveBeenCalled();
	});

	it('returns orchestrated generation output for valid requests', async () => {
		const fetchMock = vi.fn(async () =>
			new Response(
				JSON.stringify({
					ok: true,
					value: {
						images: [
							{
								id: 'image-1',
								format: 'png',
								mimeType: 'image/png',
								data: 'abc123',
								encoding: 'base64'
							}
						],
						revisedPrompt: 'black and white revised prompt',
						modelMetadata: {
							provider: 'xai',
							model: 'grok-imagine-image'
						}
					}
				}),
				{
					status: 200,
					headers: { 'Content-Type': 'application/json' }
				}
			)
		);

		const response = await POST(
			buildEvent(
				{
					spec: validSpec,
					styleHint: 'glam sparkle icons'
				},
				fetchMock
			)
		);
		const payload = await response.json();

		expect(response.status).toBe(200);
		expect(payload.ok).toBe(true);
		expect(payload.value.prompt).toContain('Black-and-white coloring book page');
		expect(payload.value.images).toHaveLength(1);
		expect(Array.isArray(payload.value.violations)).toBe(true);
		expect(Array.isArray(payload.value.recommendedFixes)).toBe(true);
		expect(fetchMock).toHaveBeenCalledTimes(1);
		expect(fetchMock).toHaveBeenCalledWith(
			'/api/image-generation',
			expect.objectContaining({ method: 'POST' })
		);
	});
});
