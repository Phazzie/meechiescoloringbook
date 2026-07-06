// Purpose: Verify /api/image-generation input validation and pipeline error handling.
// Why: Ensure the pipeline surfaces actionable errors and routes through the seam correctly.
// Info flow: Request payload -> endpoint -> contract-shaped result.
import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('$lib/adapters/image-generation-seam', () => ({
  createImageGenerationSeam: vi.fn()
}));

vi.mock('$lib/adapters/app-config-seam', () => ({
  createAppConfigSeam: vi.fn()
}));

import { createImageGenerationSeam } from '$lib/adapters/image-generation-seam';
import { POST } from '../../src/routes/api/image-generation/+server';
import { nextClientAddress } from '../helpers/next-client-address';

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

const validPrompt = [
  'Black-and-white coloring book page',
  'outline-only',
  'easy to color',
  'Crisp vector-like linework',
  'NEGATIVE PROMPT:',
  'US Letter 8.5x11 portrait.'
].join(' ');

const buildEvent = (body: unknown) =>
  ({
    request: new Request('http://localhost/api/image-generation', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    }),
    getClientAddress: nextClientAddress
  }) as Parameters<typeof POST>[0];

const buildRawEvent = (rawBody: string) =>
  ({
    request: new Request('http://localhost/api/image-generation', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: rawBody
    }),
    getClientAddress: nextClientAddress
  }) as Parameters<typeof POST>[0];

describe('/api/image-generation', () => {
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
    expect(payload.error.code).toBe('IMAGE_INPUT_INVALID');
  });

  it('returns 502 when seam returns a network error', async () => {
    mockCreateSeam.mockReturnValue({
      generate: vi.fn(async () => ({
        ok: false as const,
        error: {
          code: 'IMAGE_NETWORK_ERROR' as const,
          message: 'Connection refused'
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

    expect(response.status).toBe(502);
    expect(payload.ok).toBe(false);
  });

  it('returns 200 with images when seam succeeds', async () => {
    mockCreateSeam.mockReturnValue({
      generate: vi.fn(async () => ({
        ok: true as const,
        value: {
          images: [{ id: 'xai-1', b64: 'abc123' }],
          rawModelInfo: { revisedPrompt: 'prompt' },
          timingMs: 50
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

    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload.ok).toBe(true);
    expect(mockCreateSeam).toHaveBeenCalled();
  });

  it('returns 429 with a Retry-After header once a client exceeds the rate limit', async () => {
    mockCreateSeam.mockReturnValue({
      generate: vi.fn(async () => ({
        ok: true as const,
        value: {
          images: [{ id: 'xai-1', b64: 'abc123' }],
          rawModelInfo: { revisedPrompt: 'prompt' },
          timingMs: 50
        }
      }))
    });
    const sameClient = () => 'rate-limit-test-client';
    const request = () =>
      ({
        request: new Request('http://localhost/api/image-generation', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ spec: validSpec, prompt: validPrompt, variations: 1, outputFormat: 'pdf' })
        }),
        getClientAddress: sameClient
      }) as Parameters<typeof POST>[0];

    let lastResponse: Response | undefined;
    for (let i = 0; i < 6; i += 1) {
      lastResponse = await POST(request());
      if (i < 5) {
        expect(lastResponse.status).not.toBe(429);
      }
    }

    expect(lastResponse?.status).toBe(429);
    expect(lastResponse?.headers.get('Retry-After')).toBeTruthy();
    const payload = await lastResponse?.json();
    expect(payload.ok).toBe(false);
    expect(payload.error.code).toBe('RATE_LIMIT_EXCEEDED');
  });
});
