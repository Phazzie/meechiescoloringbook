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

vi.mock('$lib/server/rate-limit-route', () => ({
  createQuotaGate: vi.fn()
}));

import { createImageGenerationSeam } from '$lib/adapters/image-generation-seam';
import { createQuotaGate } from '$lib/server/rate-limit-route';
import type { QuotaDecision } from '$lib/server/rate-limit-route';
import { POST } from '../../src/routes/api/image-generation/+server';

const mockCreateSeam = vi.mocked(createImageGenerationSeam);

const CLIENT_ADDRESS = '203.0.113.7';

const ALLOWED_HEADERS = {
  'Cache-Control': 'no-store',
  'RateLimit-Limit': '8',
  'RateLimit-Remaining': '7',
  'RateLimit-Reset': '58'
};

const gateReturning = (decision: QuotaDecision) => {
  const consumeQuota = vi.fn(async (_cost: number) => decision);
  vi.mocked(createQuotaGate).mockReturnValue(consumeQuota);
  return consumeQuota;
};

const allowingGate = (headers: Record<string, string> = ALLOWED_HEADERS) =>
  gateReturning({ ok: true, headers });

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

const providerLeakCanary =
  'RAW_PROVIDER_BODY https://api.x.ai/v1/images?key=xai-secret-canary 550e8400-e29b-41d4-a716-446655440000 account=acct-canary team=team-canary';

const expectProviderLeakCanaryRedacted = (payload: unknown): void => {
  const serialized = JSON.stringify(payload);
  for (const token of [
    'RAW_PROVIDER_BODY',
    'https://api.x.ai/v1/images?key=xai-secret-canary',
    'xai-secret-canary',
    '550e8400-e29b-41d4-a716-446655440000',
    'acct-canary',
    'team-canary'
  ]) {
    expect(serialized).not.toContain(token);
  }
};

const buildEvent = (body: unknown) =>
  ({
    request: new Request('http://localhost/api/image-generation', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    }),
    getClientAddress: () => CLIENT_ADDRESS
  }) as unknown as Parameters<typeof POST>[0];

const buildRawEvent = (rawBody: string) =>
  ({
    request: new Request('http://localhost/api/image-generation', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: rawBody
    }),
    getClientAddress: () => CLIENT_ADDRESS
  }) as unknown as Parameters<typeof POST>[0];

describe('/api/image-generation', () => {
  beforeEach(() => {
    mockCreateSeam.mockReset();
    vi.mocked(createQuotaGate).mockReset();
    allowingGate();
  });

  it('rejects malformed JSON with INVALID_JSON code', async () => {
    const response = await POST(buildRawEvent('{not: valid json}'));
    const payload = await response.json();
    expect(response.status).toBe(400);
    expect(payload.ok).toBe(false);
    expect(payload.error.code).toBe('INVALID_JSON');
    expect(createQuotaGate).not.toHaveBeenCalled();
  });

  it('rejects invalid payloads', async () => {
    const consumeQuota = allowingGate();
    const response = await POST(buildEvent({ spec: {} }));
    const payload = await response.json();
    expect(response.status).toBe(400);
    expect(payload.ok).toBe(false);
    expect(payload.error.code).toBe('IMAGE_INPUT_INVALID');
    // A rejected request is free, and it never advertises quota it did not spend.
    expect(consumeQuota).not.toHaveBeenCalled();
    expect(response.headers.get('RateLimit-Remaining')).toBeNull();
  });

  it('returns 502 when seam returns a network error', async () => {
    const consumeQuota = allowingGate();
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
    // Post-charge failure: the units are gone, so the response still reports them, verbatim.
    expect(consumeQuota).toHaveBeenCalledTimes(1);
    expect(response.headers.get('RateLimit-Limit')).toBe('8');
    expect(response.headers.get('RateLimit-Remaining')).toBe('7');
    expect(response.headers.get('RateLimit-Reset')).toBe('58');
    expect(response.headers.get('Cache-Control')).toBe('no-store');
  });

  it('does not serialize upstream provider diagnostics', async () => {
    mockCreateSeam.mockReturnValue({
      generate: vi.fn(async () => ({
        ok: false as const,
        error: {
          code: 'IMAGE_HTTP_ERROR' as const,
          message: providerLeakCanary,
          details: {
            body: providerLeakCanary,
            accountId: 'acct-canary',
            teamId: 'team-canary'
          }
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
    expect(payload.error.code).toBe('IMAGE_HTTP_ERROR');
    expectProviderLeakCanaryRedacted(payload);
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

  it('returns the gate 429 with Retry-After and never calls the provider', async () => {
    const consumeQuota = gateReturning({
      ok: false,
      status: 429,
      headers: {
        'Cache-Control': 'no-store',
        'RateLimit-Limit': '8',
        'RateLimit-Remaining': '0',
        'RateLimit-Reset': '42',
        'Retry-After': '42'
      },
      body: {
        ok: false,
        error: {
          code: 'RATE_LIMITED',
          message: 'Too many requests. Try again after the current window resets.'
        }
      }
    });
    // Resolves on purpose: if the gate is skipped the route returns 200 and the assertions
    // below name the real defect instead of crashing on an unstubbed provider.
    const generate = vi.fn(async () => ({
      ok: true as const,
      value: {
        images: [{ id: 'xai-1', b64: 'iVBORw0KGgo=' }],
        rawModelInfo: { model: 'grok-imagine-image' },
        timingMs: 5
      }
    }));
    mockCreateSeam.mockReturnValue({ generate });

    const response = await POST(
      buildEvent({
        spec: validSpec,
        prompt: validPrompt,
        variations: 1,
        outputFormat: 'pdf'
      })
    );
    const payload = await response.json();

    expect(response.status).toBe(429);
    expect(response.headers.get('Retry-After')).toBe('42');
    expect(response.headers.get('RateLimit-Limit')).toBe('8');
    expect(response.headers.get('RateLimit-Remaining')).toBe('0');
    expect(response.headers.get('RateLimit-Reset')).toBe('42');
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    expect(payload).toEqual({
      ok: false,
      error: {
        code: 'RATE_LIMITED',
        message: 'Too many requests. Try again after the current window resets.'
      }
    });
    expect(createQuotaGate).toHaveBeenCalledWith(
      expect.objectContaining({ getClientAddress: expect.any(Function) }),
      'image'
    );
    expect(consumeQuota).toHaveBeenCalledTimes(1);
    expect(consumeQuota).toHaveBeenCalledWith(1);
    expect(generate).not.toHaveBeenCalled();
  });

  it('charges four units for a four-variation request, not one', async () => {
    const consumeQuota = allowingGate({
      'Cache-Control': 'no-store',
      'RateLimit-Limit': '8',
      'RateLimit-Remaining': '4',
      'RateLimit-Reset': '58'
    });
    const generate = vi.fn(async () => ({
      ok: true as const,
      value: {
        images: [
          { id: 'xai-1', b64: 'iVBORw0KGgo=' },
          { id: 'xai-2', b64: 'iVBORw0KGgo=' },
          { id: 'xai-3', b64: 'iVBORw0KGgo=' },
          { id: 'xai-4', b64: 'iVBORw0KGgo=' }
        ],
        rawModelInfo: { model: 'grok-imagine-image' },
        timingMs: 5
      }
    }));
    mockCreateSeam.mockReturnValue({ generate });

    const response = await POST(
      buildEvent({
        spec: { ...validSpec, variations: 4 },
        prompt: validPrompt,
        variations: 4,
        outputFormat: 'pdf'
      })
    );

    expect(response.status).toBe(200);
    // One request, four provider images: the charge is the variation count, not one.
    expect(consumeQuota).toHaveBeenCalledTimes(1);
    expect(consumeQuota).toHaveBeenCalledWith(4);
    expect(generate).toHaveBeenCalledTimes(1);
    expect(generate).toHaveBeenCalledWith(expect.objectContaining({ n: 4 }));
    expect(response.headers.get('RateLimit-Remaining')).toBe('4');
  });

  it('fails closed with the gate 503 and never calls the provider', async () => {
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
    const generate = vi.fn(async () => ({
      ok: true as const,
      value: {
        images: [{ id: 'xai-1', b64: 'iVBORw0KGgo=' }],
        rawModelInfo: { model: 'grok-imagine-image' },
        timingMs: 5
      }
    }));
    mockCreateSeam.mockReturnValue({ generate });

    const response = await POST(
      buildEvent({
        spec: validSpec,
        prompt: validPrompt,
        variations: 1,
        outputFormat: 'pdf'
      })
    );
    const payload = await response.json();

    expect(response.status).toBe(503);
    // Same status as a provider-config 503, told apart by the code.
    expect(payload.error.code).toBe('RATE_LIMIT_UNAVAILABLE');
    expect(payload.error.code).not.toBe('IMAGE_CONFIG_ERROR');
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    expect(response.headers.get('Retry-After')).toBeNull();
    expect(consumeQuota).toHaveBeenCalledWith(1);
    expect(generate).not.toHaveBeenCalled();
  });

  it('builds the gate from the real event address lookup, not a header', async () => {
    const getClientAddress = vi.fn(() => CLIENT_ADDRESS);
    allowingGate();
    mockCreateSeam.mockReturnValue({
      generate: vi.fn(async () => ({
        ok: true as const,
        value: {
          images: [{ id: 'xai-1', b64: 'iVBORw0KGgo=' }],
          rawModelInfo: { model: 'grok-imagine-image' },
          timingMs: 5
        }
      }))
    });

    await POST({
      request: new Request('http://localhost/api/image-generation', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Forwarded-For': '198.51.100.23'
        },
        body: JSON.stringify({
          spec: validSpec,
          prompt: validPrompt,
          variations: 1,
          outputFormat: 'pdf'
        })
      }),
      getClientAddress
    } as unknown as Parameters<typeof POST>[0]);

    expect(createQuotaGate).toHaveBeenCalledTimes(1);
    const [gateEvent, bucket] = vi.mocked(createQuotaGate).mock.calls[0] ?? [];
    expect(bucket).toBe('image');
    expect(gateEvent?.getClientAddress).toBe(getClientAddress);
  });

  it('does not charge a caller who already hung up', async () => {
    const consumeQuota = allowingGate();
    const generate = vi.fn();
    mockCreateSeam.mockReturnValue({ generate });
    const controller = new AbortController();
    controller.abort();

    const response = await POST({
      request: {
        json: async () => ({
          spec: validSpec,
          prompt: validPrompt,
          variations: 4,
          outputFormat: 'pdf'
        }),
        headers: new Headers({ 'Content-Type': 'application/json' }),
        signal: controller.signal
      },
      getClientAddress: () => CLIENT_ADDRESS
    } as unknown as Parameters<typeof POST>[0]);
    const payload = await response.json();

    expect(response.status).toBe(499);
    expect(payload.error.code).toBe('IMAGE_ABORTED');
    expect(consumeQuota).not.toHaveBeenCalled();
    expect(response.headers.get('RateLimit-Remaining')).toBeNull();
    expect(generate).not.toHaveBeenCalled();
  });
});
