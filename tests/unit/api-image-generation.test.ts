// Purpose: Verify /api/image-generation input validation and server-side API key behavior.
// Why: Ensure the route delegates to the ImageGenerationSeam-backed pipeline correctly.
// Info flow: Request payload + seam mock -> endpoint -> contract-shaped result.
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../src/lib/adapters/image-generation-seam', () => ({
createImageGenerationSeam: vi.fn()
}));

import { createImageGenerationSeam } from '../../src/lib/adapters/image-generation-seam';
import { POST } from '../../src/routes/api/image-generation/+server';

const mockCreateImageGenerationSeam = vi.mocked(createImageGenerationSeam);
const mockGenerate = vi.fn();

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

const buildEvent = (body: unknown, asInvalidJson = false) =>
({
request: asInvalidJson
? new Request('http://localhost/api/image-generation', {
method: 'POST',
headers: { 'Content-Type': 'application/json' },
body: '{'
})
: new Request('http://localhost/api/image-generation', {
method: 'POST',
headers: { 'Content-Type': 'application/json' },
body: JSON.stringify(body)
})
}) as Parameters<typeof POST>[0];

describe('/api/image-generation', () => {
beforeEach(() => {
mockGenerate.mockReset();
mockCreateImageGenerationSeam.mockReset();
mockCreateImageGenerationSeam.mockReturnValue({
generate: mockGenerate
});
});

it('rejects invalid payloads', async () => {
const response = await POST(buildEvent({ spec: {} }));
const payload = await response.json();
expect(response.status).toBe(400);
expect(payload.ok).toBe(false);
expect(payload.error.code).toBe('IMAGE_INPUT_INVALID');
});

it('returns missing-key guidance when provider key is absent', async () => {
mockGenerate.mockResolvedValue({
ok: false,
error: {
code: 'PROVIDER_API_KEY_MISSING',
message: 'XAI_API_KEY is required.'
}
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
expect(payload.error.message).toContain('XAI_API_KEY to be set on the server');
});

it('delegates to the seam adapter on valid requests', async () => {
mockGenerate.mockResolvedValue({
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
revisedPrompt: 'prompt',
modelMetadata: { provider: 'xai', model: 'grok-imagine-image' }
}
});

const response = await POST(
buildEvent({
spec: validSpec,
prompt: validPrompt,
variations: 1,
outputFormat: 'pdf'
})
);

expect(response.status).toBe(200);
expect(mockCreateImageGenerationSeam).toHaveBeenCalledWith();
expect(mockGenerate).toHaveBeenCalledOnce();
});

it('treats malformed JSON body as invalid input', async () => {
const response = await POST(buildEvent({}, true));
const payload = await response.json();
expect(response.status).toBe(400);
expect(payload.ok).toBe(false);
expect(payload.error.code).toBe('IMAGE_INPUT_INVALID');
});
});
