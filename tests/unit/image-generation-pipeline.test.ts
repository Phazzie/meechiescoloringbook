// Purpose: Unit tests for image-generation-pipeline status mapping and seam integration.
// Why: Ensure endpoint orchestration delegates to ImageGenerationSeam and preserves expected HTTP responses.
// Info flow: Pipeline inputs + seam stubs -> pipeline outputs -> assertions.
import { describe, expect, it, vi } from 'vitest';
import { runImageGenerationPipeline } from '../../src/lib/core/image-generation-pipeline';
import type { ImageGenerationSeam } from '../../src/lib/seams/image-generation-seam/contract';

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

const validInput = {
spec: validSpec,
prompt: [
'Black-and-white coloring book page',
'outline-only',
'easy to color',
'Crisp vector-like linework',
'NEGATIVE PROMPT:',
'US Letter 8.5x11 portrait.'
].join(' '),
variations: 1,
outputFormat: 'pdf'
};

const createSeam = (generate: ImageGenerationSeam['generate']) => ({
createImageSeam: () => ({ generate })
});

describe('image-generation-pipeline edge cases', () => {
it('rejects invalid input', async () => {
const result = await runImageGenerationPipeline(
{ spec: {} },
createSeam(vi.fn())
);
expect(result.status).toBe(400);
expect(result.body.ok).toBe(false);
if (!result.body.ok) {
expect(result.body.error.code).toBe('IMAGE_INPUT_INVALID');
}
});

it('returns 400 for seam input/prompt errors', async () => {
const result = await runImageGenerationPipeline(
validInput,
createSeam(
vi.fn().mockResolvedValue({
ok: false,
error: {
code: 'PROMPT_MISSING_REQUIRED_PHRASES',
message: 'Prompt missing required phrases for deterministic generation.'
}
})
)
);
expect(result.status).toBe(400);
expect(result.body.ok).toBe(false);
if (!result.body.ok) {
expect(result.body.error.code).toBe('PROMPT_MISSING_REQUIRED_PHRASES');
}
});

it('returns 401 when provider API key is missing', async () => {
const result = await runImageGenerationPipeline(
validInput,
createSeam(
vi.fn().mockResolvedValue({
ok: false,
error: {
code: 'PROVIDER_API_KEY_MISSING',
message: 'XAI_API_KEY is required.'
}
})
)
);
expect(result.status).toBe(401);
expect(result.body.ok).toBe(false);
if (!result.body.ok) {
expect(result.body.error.code).toBe('PROVIDER_API_KEY_MISSING');
expect(result.body.error.message).toContain('XAI_API_KEY to be set on the server');
}
});

it('returns 502 for non-auth seam failures', async () => {
const result = await runImageGenerationPipeline(
validInput,
createSeam(
vi.fn().mockResolvedValue({
ok: false,
error: {
code: 'PROVIDER_HTTP_ERROR',
message: 'Service unavailable'
}
})
)
);
expect(result.status).toBe(502);
expect(result.body.ok).toBe(false);
});

it('succeeds with seam success result', async () => {
const result = await runImageGenerationPipeline(
validInput,
createSeam(
vi.fn().mockResolvedValue({
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
revisedPrompt: 'revised prompt',
modelMetadata: { provider: 'xai', model: 'grok-imagine-image' }
}
})
)
);
expect(result.status).toBe(200);
expect(result.body.ok).toBe(true);
if (result.body.ok) {
expect(result.body.value.images).toHaveLength(1);
expect(result.body.value.images[0].encoding).toBe('base64');
expect(result.body.value.revisedPrompt).toBe('revised prompt');
}
});
});
