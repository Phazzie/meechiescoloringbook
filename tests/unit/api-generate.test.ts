// Purpose: Verify /api/generate orchestrates prompt, image, and drift flow for the UI.
// Why: Keep the main generation path on one server endpoint with contract-checked output.
// Info flow: Generate request -> endpoint orchestration -> contract response.
import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('$lib/adapters/image-generation-seam', () => ({
	createImageGenerationSeam: vi.fn()
}));

vi.mock('$lib/adapters/image-provider-config-seam', () => ({
	createImageProviderConfigSeam: vi.fn()
}));

import { createImageGenerationSeam } from '$lib/adapters/image-generation-seam';
import { POST } from '../../src/routes/api/generate/+server';

const mockCreateSeam = vi.mocked(createImageGenerationSeam);

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
		request: new Request('http://localhost/api/generate', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(body)
		})
	}) as Parameters<typeof POST>[0];

const buildRawEvent = (rawBody: string): Parameters<typeof POST>[0] =>
	({
		request: new Request('http://localhost/api/generate', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: rawBody
		})
	}) as Parameters<typeof POST>[0];

describe('/api/generate', () => {
	beforeEach(() => {
		mockCreateSeam.mockReset();
	});

	it('rejects malformed JSON with INVALID_JSON code', async () => {
		const response = await POST(buildRawEvent('{not: valid json}'));
		const payload = await response.json();

		expect(response.status).toBe(400);
		expect(payload.ok).toBe(false);
		expect(payload.error.code).toBe('INVALID_JSON');
	});

	it('rejects invalid payloads', async () => {
		const response = await POST(buildEvent({ spec: {} }));
		const payload = await response.json();

		expect(response.status).toBe(400);
		expect(payload.ok).toBe(false);
		expect(payload.error.code).toBe('GENERATE_INPUT_INVALID');
	});

	it('returns orchestrated generation output for valid requests', async () => {
		mockCreateSeam.mockReturnValue({
			generate: vi.fn(async () => ({
				ok: true as const,
				value: {
					images: [{ id: 'xai-1', b64: 'abc123' }],
					rawModelInfo: { model: 'grok-imagine-image', revisedPrompt: 'black and white revised prompt' },
					timingMs: 50
				}
			}))
		});

		const response = await POST(
			buildEvent({
				spec: validSpec,
				styleHint: 'glam sparkle icons'
			})
		);
		const payload = await response.json();

		expect(response.status).toBe(200);
		expect(payload.ok).toBe(true);
		expect(payload.value.prompt).toContain('Black-and-white coloring book page');
		expect(payload.value.images).toHaveLength(1);
		expect(Array.isArray(payload.value.violations)).toBe(true);
		expect(Array.isArray(payload.value.recommendedFixes)).toBe(true);
		expect(mockCreateSeam).toHaveBeenCalledTimes(1);
	});
});
