// Purpose: Unit tests for image-generation-pipeline edge cases.
// Why: Ensure prompt phrase validation, seam error handling, and image extraction work correctly.
// Info flow: Pipeline inputs -> function logic -> verified responses.
import { describe, expect, it, vi } from 'vitest';
import { runImageGenerationPipeline } from '../../src/lib/core/image-generation-pipeline';
import type { ImagePipelineDeps } from '../../src/lib/core/image-generation-pipeline';

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

const pngBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJ';

const makeDeps = (
  generateImpl: ImagePipelineDeps['imageGenerationSeam']['generate']
): ImagePipelineDeps => ({
  imageGenerationSeam: {
    generate: vi.fn(generateImpl) as ImagePipelineDeps['imageGenerationSeam']['generate']
  }
});

describe('image-generation-pipeline edge cases', () => {
  it('rejects invalid input', async () => {
    const result = await runImageGenerationPipeline(
      { spec: {} },
      makeDeps(async () => ({ ok: true, value: { images: [], rawModelInfo: {}, timingMs: 0 } }))
    );
    expect(result.status).toBe(400);
    expect(result.body.ok).toBe(false);
    if (!result.body.ok) {
      expect(result.body.error.code).toBe('IMAGE_INPUT_INVALID');
    }
  });

  it('rejects prompt missing required phrases', async () => {
    const result = await runImageGenerationPipeline(
      {
        spec: validSpec,
        prompt: 'A simple coloring page',
        variations: 1,
        outputFormat: 'pdf'
      },
      makeDeps(async () => ({ ok: true, value: { images: [], rawModelInfo: {}, timingMs: 0 } }))
    );
    expect(result.status).toBe(400);
    expect(result.body.ok).toBe(false);
    if (!result.body.ok) {
      expect(result.body.error.code).toBe('PROMPT_MISSING_REQUIRED_PHRASES');
    }
  });

  it('returns 502 when seam returns a network error', async () => {
    const result = await runImageGenerationPipeline(
      {
        spec: validSpec,
        prompt: validPrompt,
        variations: 1,
        outputFormat: 'pdf'
      },
      makeDeps(async () => ({
        ok: false,
        error: { code: 'IMAGE_NETWORK_ERROR', message: 'Connection refused' }
      }))
    );
    expect(result.status).toBe(502);
    expect(result.body.ok).toBe(false);
  });

  it('returns 504 when seam returns a timeout error', async () => {
    const result = await runImageGenerationPipeline(
      {
        spec: validSpec,
        prompt: validPrompt,
        variations: 1,
        outputFormat: 'pdf'
      },
      makeDeps(async () => ({
        ok: false,
        error: { code: 'IMAGE_TIMEOUT_ERROR', message: 'xAI image generation timed out.' } as never
      }))
    );
    expect(result.status).toBe(504);
    expect(result.body.ok).toBe(false);
    if (!result.body.ok) {
      expect(result.body.error.code).toBe('IMAGE_TIMEOUT_ERROR');
    }
  });

  it('returns 400 when seam returns a request validation error', async () => {
    const result = await runImageGenerationPipeline(
      {
        spec: validSpec,
        prompt: validPrompt,
        variations: 1,
        outputFormat: 'pdf'
      },
      makeDeps(async () => ({
        ok: false,
        error: { code: 'IMAGE_VALIDATION_ERROR', message: 'bad image request' }
      }))
    );
    expect(result.status).toBe(400);
    expect(result.body.ok).toBe(false);
    if (!result.body.ok) {
      expect(result.body.error.code).toBe('IMAGE_VALIDATION_ERROR');
    }
  });

  it('returns an aborted response before calling the seam when caller signal is already aborted', async () => {
    const controller = new AbortController();
    controller.abort();
    const generate = vi.fn(async () => ({
      ok: true as const,
      value: {
        images: [{ id: 'xai-1', b64: pngBase64 }],
        rawModelInfo: {},
        timingMs: 100
      }
    }));

    const result = await runImageGenerationPipeline(
      {
        spec: validSpec,
        prompt: validPrompt,
        variations: 1,
        outputFormat: 'pdf'
      },
      {
        imageGenerationSeam: { generate },
        signal: controller.signal
      } as ImagePipelineDeps
    );

    expect(result.status).toBe(499);
    expect(result.body.ok).toBe(false);
    if (!result.body.ok) {
      expect(result.body.error.code).toBe('IMAGE_ABORTED');
    }
    expect(generate).not.toHaveBeenCalled();
  });

  it('passes caller signal into ImageGenerationSeam requests', async () => {
    const controller = new AbortController();
    const generate = vi.fn(async () => ({
      ok: true as const,
      value: {
        images: [{ id: 'xai-1', b64: pngBase64 }],
        rawModelInfo: {},
        timingMs: 100
      }
    }));

    await runImageGenerationPipeline(
      {
        spec: validSpec,
        prompt: validPrompt,
        variations: 1,
        outputFormat: 'pdf'
      },
      {
        imageGenerationSeam: { generate },
        signal: controller.signal
      } as ImagePipelineDeps
    );

    expect(generate).toHaveBeenCalledWith(
      expect.objectContaining({ signal: controller.signal })
    );
  });

  it('returns 502 when seam returns an HTTP error', async () => {
    const result = await runImageGenerationPipeline(
      {
        spec: validSpec,
        prompt: validPrompt,
        variations: 1,
        outputFormat: 'pdf'
      },
      makeDeps(async () => ({
        ok: false,
        error: {
          code: 'IMAGE_HTTP_ERROR',
          message: 'xAI returned 502',
          details: { status: '502' }
        }
      }))
    );
    expect(result.status).toBe(502);
    expect(result.body.ok).toBe(false);
  });

  it('returns error when seam returns images without b64', async () => {
    const result = await runImageGenerationPipeline(
      {
        spec: validSpec,
        prompt: validPrompt,
        variations: 1,
        outputFormat: 'pdf'
      },
      makeDeps(async () => ({
        ok: true,
        value: {
          images: [{ id: 'xai-1', url: 'https://example.com/img.png' }],
          rawModelInfo: {},
          timingMs: 100
        }
      }))
    );
    expect(result.status).toBe(502);
    expect(result.body.ok).toBe(false);
    if (!result.body.ok) {
      expect(result.body.error.code).toBe('PROVIDER_EMPTY_IMAGE');
    }
  });

  it('succeeds with valid b64 images', async () => {
    const result = await runImageGenerationPipeline(
      {
        spec: validSpec,
        prompt: validPrompt,
        variations: 1,
        outputFormat: 'pdf'
      },
      makeDeps(async () => ({
        ok: true,
        value: {
          images: [{ id: 'xai-1', b64: pngBase64 }],
          rawModelInfo: { revisedPrompt: 'revised prompt' },
          timingMs: 100
        }
      }))
    );
    expect(result.status).toBe(200);
    expect(result.body.ok).toBe(true);
    if (result.body.ok) {
      expect(result.body.value.images).toHaveLength(1);
      expect(result.body.value.images[0].format).toBe('png');
      expect(result.body.value.images[0].mimeType).toBe('image/png');
      expect(result.body.value.images[0].encoding).toBe('base64');
      expect(result.body.value.revisedPrompt).toBe('revised prompt');
    }
  });

  it('defaults to png for unrecognized base64 headers', async () => {
    const result = await runImageGenerationPipeline(
      {
        spec: validSpec,
        prompt: validPrompt,
        variations: 1,
        outputFormat: 'pdf'
      },
      makeDeps(async () => ({
        ok: true,
        value: {
          images: [{ id: 'xai-1', b64: 'not-a-known-image-header' }],
          rawModelInfo: {},
          timingMs: 100
        }
      }))
    );

    expect(result.status).toBe(200);
    expect(result.body.ok).toBe(true);
    if (result.body.ok) {
      expect(result.body.value.images[0].format).toBe('png');
      expect(result.body.value.images[0].mimeType).toBe('image/png');
    }
  });

  it('marks JPEG base64 as jpg for downstream packaging', async () => {
    const result = await runImageGenerationPipeline(
      {
        spec: validSpec,
        prompt: validPrompt,
        variations: 1,
        outputFormat: 'pdf'
      },
      makeDeps(async () => ({
        ok: true,
        value: {
          images: [{ id: 'xai-1', b64: '/9j/jpeg-data' }],
          rawModelInfo: {},
          timingMs: 100
        }
      }))
    );

    expect(result.status).toBe(200);
    expect(result.body.ok).toBe(true);
    if (result.body.ok) {
      expect(result.body.value.images[0].format).toBe('jpg');
      expect(result.body.value.images[0].mimeType).toBe('image/jpeg');
    }
  });

  it('filters out images without b64 and keeps valid ones', async () => {
    const result = await runImageGenerationPipeline(
      {
        spec: validSpec,
        prompt: validPrompt,
        variations: 2,
        outputFormat: 'pdf'
      },
      makeDeps(async () => ({
        ok: true,
        value: {
          images: [
            { id: 'xai-1', url: 'https://only-url.png' },
            { id: 'xai-2', b64: pngBase64 }
          ],
          rawModelInfo: {},
          timingMs: 100
        }
      }))
    );
    expect(result.status).toBe(200);
    expect(result.body.ok).toBe(true);
    if (result.body.ok) {
      expect(result.body.value.images).toHaveLength(1);
      expect(result.body.value.images[0].id).toBe('image-2');
    }
  });

  it('validates A4 page size phrase check', async () => {
    const a4Prompt = [
      'Black-and-white coloring book page',
      'outline-only',
      'easy to color',
      'Crisp vector-like linework',
      'NEGATIVE PROMPT:',
      'A4 8.27x11.69 portrait.'
    ].join(' ');

    const a4Spec = { ...validSpec, pageSize: 'A4' as const };

    const result = await runImageGenerationPipeline(
      {
        spec: a4Spec,
        prompt: a4Prompt,
        variations: 1,
        outputFormat: 'pdf'
      },
      makeDeps(async () => ({
        ok: true,
        value: {
          images: [{ id: 'xai-1', b64: pngBase64 }],
          rawModelInfo: {},
          timingMs: 100
        }
      }))
    );
    expect(result.status).toBe(200);
    expect(result.body.ok).toBe(true);
  });
});
