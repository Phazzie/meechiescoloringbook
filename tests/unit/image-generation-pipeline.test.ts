// Purpose: Unit tests for image-generation-pipeline edge cases.
// Why: Ensure prompt phrase validation, seam error handling, and image extraction work correctly.
// Info flow: Pipeline inputs -> function logic -> verified responses.
import { describe, expect, it, vi } from 'vitest';
import { runImageGenerationPipeline } from '../../src/lib/core/image-generation-pipeline';
import type {
  ImagePipelineDeps,
  ImageQuota
} from '../../src/lib/core/image-generation-pipeline';
import type { QuotaDecision } from '../../src/lib/server/rate-limit-route';

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

const ALLOWED_HEADERS = {
  'Cache-Control': 'no-store',
  'RateLimit-Limit': '8',
  'RateLimit-Remaining': '4',
  'RateLimit-Reset': '58'
};

const gateReturning = (decision: QuotaDecision) =>
  vi.fn(async (_cost: number) => decision);

const allowingGate = (headers: Record<string, string> = ALLOWED_HEADERS) =>
  gateReturning({ ok: true, headers });

// The quota mode is a required dep, deliberately: there is no way to spell "no quota", so a
// pipeline run that reaches the provider has always been paid for exactly once.
const makeDeps = (
  generateImpl: ImagePipelineDeps['imageGenerationSeam']['generate'],
  quota: ImageQuota = { mode: 'charge', consumeQuota: allowingGate() }
): ImagePipelineDeps => ({
  imageGenerationSeam: {
    generate: vi.fn(
      generateImpl
    ) as ImagePipelineDeps['imageGenerationSeam']['generate']
  },
  quota
});

describe('image-generation-pipeline edge cases', () => {
  it('rejects invalid input', async () => {
    const result = await runImageGenerationPipeline(
      { spec: {} },
      makeDeps(async () => ({
        ok: true,
        value: { images: [], rawModelInfo: {}, timingMs: 0 }
      }))
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
      makeDeps(async () => ({
        ok: true,
        value: { images: [], rawModelInfo: {}, timingMs: 0 }
      }))
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
    if (!result.body.ok) {
      expect(result.body.error).toEqual({
        code: 'IMAGE_NETWORK_ERROR',
        message: 'Image generation provider request failed.'
      });
    }
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
        error: {
          code: 'IMAGE_TIMEOUT_ERROR',
          message: 'xAI image generation timed out.'
        } as never
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
        quota: { mode: 'charge', consumeQuota: allowingGate() },
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
        quota: { mode: 'charge', consumeQuota: allowingGate() },
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
    if (!result.body.ok) {
      expect(result.body.error).toEqual({
        code: 'IMAGE_HTTP_ERROR',
        message: 'Image generation provider request failed.'
      });
    }
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

  // Shared by every format-detection case below: only the b64 payload differs.
  const runWithImageB64 = (b64: string) =>
    runImageGenerationPipeline(
      {
        spec: validSpec,
        prompt: validPrompt,
        variations: 1,
        outputFormat: 'pdf'
      },
      makeDeps(async () => ({
        ok: true,
        value: {
          images: [{ id: 'xai-1', b64 }],
          rawModelInfo: {},
          timingMs: 100
        }
      }))
    );

  it('defaults to png for unrecognized base64 headers', async () => {
    const result = await runWithImageB64('not-a-known-image-header');

    expect(result.status).toBe(200);
    expect(result.body.ok).toBe(true);
    if (result.body.ok) {
      expect(result.body.value.images[0].format).toBe('png');
      expect(result.body.value.images[0].mimeType).toBe('image/png');
    }
  });

  it('marks JPEG base64 as jpg for downstream packaging', async () => {
    const result = await runWithImageB64('/9j/jpeg-data');

    expect(result.status).toBe(200);
    expect(result.body.ok).toBe(true);
    if (result.body.ok) {
      expect(result.body.value.images[0].format).toBe('jpg');
      expect(result.body.value.images[0].mimeType).toBe('image/jpeg');
    }
  });

  it('marks WebP base64 as webp instead of defaulting to png', async () => {
    // RIFF....WEBP.... - a minimal, real WebP byte signature, base64-encoded.
    const result = await runWithImageB64('UklGRhAAAABXRUJQVlA4IA==');

    expect(result.status).toBe(200);
    expect(result.body.ok).toBe(true);
    if (result.body.ok) {
      expect(result.body.value.images[0].format).toBe('webp');
      expect(result.body.value.images[0].mimeType).toBe('image/webp');
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
      // Numbered by position in the output array, not the provider's original index —
      // the sole surviving image must be "image-1", not "image-2" with a phantom gap.
      expect(result.body.value.images[0].id).toBe('image-1');
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

describe('image-generation-pipeline quota', () => {
  const succeedingSeam = (count: number) =>
    async () => ({
      ok: true as const,
      value: {
        images: Array.from({ length: count }, (_unused, index) => ({
          id: `xai-${index + 1}`,
          b64: pngBase64
        })),
        rawModelInfo: { model: 'grok-imagine-image' },
        timingMs: 10
      }
    });

  it('charges the requested variation count, not one per request', async () => {
    const consumeQuota = allowingGate();
    const deps = makeDeps(succeedingSeam(4), { mode: 'charge', consumeQuota });

    const result = await runImageGenerationPipeline(
      {
        spec: { ...validSpec, variations: 4 },
        prompt: validPrompt,
        variations: 4,
        outputFormat: 'pdf'
      },
      deps
    );

    expect(result.status).toBe(200);
    expect(consumeQuota).toHaveBeenCalledTimes(1);
    expect(consumeQuota).toHaveBeenCalledWith(4);
    expect(deps.imageGenerationSeam.generate).toHaveBeenCalledWith(
      expect.objectContaining({ n: 4 })
    );
    // Verbatim from the gate, on the post-charge success.
    expect(result.headers).toEqual(ALLOWED_HEADERS);
  });

  it('charges what the provider is really asked for when the spec disagrees with the request', async () => {
    // ImageGenerationInputSchema carries `variations` at the top level AND inside `spec`; only
    // the top-level one becomes the provider's `n`. The charge follows the provider, not the spec.
    const consumeQuota = allowingGate();
    const deps = makeDeps(succeedingSeam(4), { mode: 'charge', consumeQuota });

    const result = await runImageGenerationPipeline(
      {
        spec: { ...validSpec, variations: 1 },
        prompt: validPrompt,
        variations: 4,
        outputFormat: 'pdf'
      },
      deps
    );

    expect(result.status).toBe(200);
    expect(consumeQuota).toHaveBeenCalledWith(4);
    expect(deps.imageGenerationSeam.generate).toHaveBeenCalledWith(
      expect.objectContaining({ n: 4 })
    );
  });

  it('returns the gate denial verbatim and never calls the provider', async () => {
    const deniedHeaders = {
      'Cache-Control': 'no-store',
      'RateLimit-Limit': '8',
      'RateLimit-Remaining': '2',
      'RateLimit-Reset': '42',
      'Retry-After': '42'
    };
    const consumeQuota = gateReturning({
      ok: false,
      status: 429,
      headers: deniedHeaders,
      body: {
        ok: false,
        error: {
          code: 'RATE_LIMITED',
          message: 'Too many requests. Try again after the current window resets.'
        }
      }
    });
    const deps = makeDeps(succeedingSeam(4), { mode: 'charge', consumeQuota });

    const result = await runImageGenerationPipeline(
      {
        spec: { ...validSpec, variations: 4 },
        prompt: validPrompt,
        variations: 4,
        outputFormat: 'pdf'
      },
      deps
    );

    expect(result.status).toBe(429);
    expect(result.headers).toEqual(deniedHeaders);
    expect(result.body).toEqual({
      ok: false,
      error: {
        code: 'RATE_LIMITED',
        message: 'Too many requests. Try again after the current window resets.'
      }
    });
    expect(consumeQuota).toHaveBeenCalledWith(4);
    expect(deps.imageGenerationSeam.generate).not.toHaveBeenCalled();
  });

  it('fails closed on a 503 from the gate and never calls the provider', async () => {
    const consumeQuota = gateReturning({
      ok: false,
      status: 503,
      headers: { 'Cache-Control': 'no-store' },
      body: {
        ok: false,
        error: {
          code: 'RATE_LIMIT_UNAVAILABLE',
          message: 'Rate limiting is temporarily unavailable.'
        }
      }
    });
    const deps = makeDeps(succeedingSeam(1), { mode: 'charge', consumeQuota });

    const result = await runImageGenerationPipeline(
      {
        spec: validSpec,
        prompt: validPrompt,
        variations: 1,
        outputFormat: 'pdf'
      },
      deps
    );

    expect(result.status).toBe(503);
    expect(result.headers).toEqual({ 'Cache-Control': 'no-store' });
    expect(deps.imageGenerationSeam.generate).not.toHaveBeenCalled();
  });

  it('advertises the spent quota on a post-charge provider failure', async () => {
    const consumeQuota = allowingGate();
    const deps = makeDeps(
      async () => ({
        ok: false as const,
        error: {
          code: 'IMAGE_NETWORK_ERROR' as const,
          message: 'Connection refused'
        }
      }),
      { mode: 'charge', consumeQuota }
    );

    const result = await runImageGenerationPipeline(
      {
        spec: validSpec,
        prompt: validPrompt,
        variations: 1,
        outputFormat: 'pdf'
      },
      deps
    );

    expect(result.status).toBe(502);
    expect(consumeQuota).toHaveBeenCalledTimes(1);
    // The units are gone, so the failure still reports them, unchanged.
    expect(result.headers).toEqual(ALLOWED_HEADERS);
  });

  it('rejects for free before the charge: aborted, invalid input, missing phrases', async () => {
    const controller = new AbortController();
    controller.abort();
    const abortGate = allowingGate();
    const aborted = await runImageGenerationPipeline(
      {
        spec: validSpec,
        prompt: validPrompt,
        variations: 4,
        outputFormat: 'pdf'
      },
      {
        ...makeDeps(succeedingSeam(4), {
          mode: 'charge',
          consumeQuota: abortGate
        }),
        signal: controller.signal
      }
    );
    expect(aborted.status).toBe(499);
    expect(abortGate).not.toHaveBeenCalled();
    expect(aborted.headers).toBeUndefined();

    const invalidGate = allowingGate();
    const invalid = await runImageGenerationPipeline(
      { spec: {} },
      makeDeps(succeedingSeam(1), {
        mode: 'charge',
        consumeQuota: invalidGate
      })
    );
    expect(invalid.status).toBe(400);
    expect(invalidGate).not.toHaveBeenCalled();
    expect(invalid.headers).toBeUndefined();

    const phraseGate = allowingGate();
    const missingPhrases = await runImageGenerationPipeline(
      {
        spec: validSpec,
        prompt: 'A simple coloring page',
        variations: 1,
        outputFormat: 'pdf'
      },
      makeDeps(succeedingSeam(1), {
        mode: 'charge',
        consumeQuota: phraseGate
      })
    );
    expect(missingPhrases.status).toBe(400);
    expect(phraseGate).not.toHaveBeenCalled();
    expect(missingPhrases.headers).toBeUndefined();
  });

  it('runs precharged without a gate and echoes the outer decision headers', async () => {
    const precharged: ImageQuota = {
      mode: 'precharged',
      headers: ALLOWED_HEADERS
    };
    const deps = makeDeps(succeedingSeam(4), precharged);

    const result = await runImageGenerationPipeline(
      {
        spec: { ...validSpec, variations: 4 },
        prompt: validPrompt,
        variations: 4,
        outputFormat: 'pdf'
      },
      deps
    );

    expect(result.status).toBe(200);
    expect(deps.imageGenerationSeam.generate).toHaveBeenCalledWith(
      expect.objectContaining({ n: 4 })
    );
    // The outer charge already paid for these four images; this run spends nothing and reports
    // the same numbers the outer decision produced.
    expect(result.headers).toEqual(ALLOWED_HEADERS);
  });
});
