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

// Stubbed so checkImageGenerationProviderConfig's getConfig() call doesn't depend on a real
// XAI_API_KEY being present in the test process environment.
vi.mock('$lib/adapters/image-provider-config-seam', () => ({
  createImageProviderConfigSeam: vi.fn(() => ({
    getConfig: () => ({
      xaiApiKey: 'test-key',
      xaiImageModel: 'grok-imagine-image',
      xaiBaseUrl: 'https://api.x.ai',
      xaiImageEndpointPath: '/v1/images/generations'
    })
  }))
}));

// Lets a single test simulate the caller disconnecting while parseRequestBody's
// internal `await request.json()` is in flight, without touching any other test's
// behavior (the no-op default leaves parseRequestBody fully real/untouched).
const lateAbortRef = vi.hoisted(() => ({ controller: null as AbortController | null }));

vi.mock('$lib/server/parse-request-body', async () => {
  const actual = await vi.importActual<typeof import('$lib/server/parse-request-body')>(
    '$lib/server/parse-request-body'
  );
  return {
    parseRequestBody: async (request: Request) => {
      lateAbortRef.controller?.abort();
      return actual.parseRequestBody(request);
    }
  };
});

import { createImageGenerationSeam } from '$lib/adapters/image-generation-seam';
import { createImageProviderConfigSeam } from '$lib/adapters/image-provider-config-seam';
import { POST } from '../../src/routes/api/image-generation/+server';

const mockCreateSeam = vi.mocked(createImageGenerationSeam);
const mockCreateConfigSeam = vi.mocked(createImageProviderConfigSeam);

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

// enforceAiRateLimit is module-scoped, so every test in this file shares one bucket per
// client key — a hardcoded key would let one test's quota consumption leak into another's
// assertions depending on run order. Each test gets its own address via beforeEach below;
// all calls within a single test still share one address (loops that assert "no quota
// consumed" rely on that).
let currentClientAddress = '203.0.113.1';
let clientAddressCounter = 0;

const buildEvent = (body: unknown) =>
  ({
    request: new Request('http://localhost/api/image-generation', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    }),
    getClientAddress: () => currentClientAddress
  }) as Parameters<typeof POST>[0];

const buildRawEvent = (rawBody: string) =>
  ({
    request: new Request('http://localhost/api/image-generation', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: rawBody
    }),
    getClientAddress: () => currentClientAddress
  }) as Parameters<typeof POST>[0];

const buildAbortedEvent = (body: unknown) => {
  const controller = new AbortController();
  controller.abort();
  return {
    request: new Request('http://localhost/api/image-generation', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal
    }),
    getClientAddress: () => currentClientAddress
  } as Parameters<typeof POST>[0];
};

const buildAbortedRawEvent = (rawBody: string) => {
  const controller = new AbortController();
  controller.abort();
  return {
    request: new Request('http://localhost/api/image-generation', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: rawBody,
      signal: controller.signal
    }),
    getClientAddress: () => currentClientAddress
  } as Parameters<typeof POST>[0];
};

const buildEventWithController = (body: unknown, controller: AbortController) =>
  ({
    request: new Request('http://localhost/api/image-generation', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal
    }),
    getClientAddress: () => currentClientAddress
  }) as Parameters<typeof POST>[0];

describe('/api/image-generation', () => {
  beforeEach(() => {
    clientAddressCounter += 1;
    currentClientAddress = `203.0.113.${clientAddressCounter}`;
    mockCreateSeam.mockReset();
    mockCreateConfigSeam.mockReset();
    mockCreateConfigSeam.mockReturnValue({
      getConfig: () => ({
        xaiApiKey: 'test-key',
        xaiImageModel: 'grok-imagine-image',
        xaiBaseUrl: 'https://api.x.ai',
        xaiImageEndpointPath: '/v1/images/generations'
      })
    });
  });

  it('rejects malformed JSON with INVALID_JSON code', async () => {
    const response = await POST(buildRawEvent('{not: valid json}'));
    const payload = await response.json();
    expect(response.status).toBe(400);
    expect(payload.ok).toBe(false);
    expect(payload.error.code).toBe('INVALID_JSON');
  });

  it('rejects an already-aborted request before any preflight checks or rate-limit consumption', async () => {
    const response = await POST(
      buildAbortedEvent({
        spec: validSpec,
        prompt: validPrompt,
        variations: 1,
        outputFormat: 'pdf'
      })
    );
    const payload = await response.json();

    expect(response.status).toBe(499);
    expect(payload.ok).toBe(false);
    expect(payload.error.code).toBe('IMAGE_ABORTED');
    expect(mockCreateSeam).not.toHaveBeenCalled();
  });

  it('rejects an already-aborted request with IMAGE_ABORTED even when the body is malformed JSON, proving the abort check runs before body parsing', async () => {
    const response = await POST(buildAbortedRawEvent('{not: valid json}'));
    const payload = await response.json();

    expect(response.status).toBe(499);
    expect(payload.ok).toBe(false);
    expect(payload.error.code).toBe('IMAGE_ABORTED');
    expect(mockCreateSeam).not.toHaveBeenCalled();
  });

  it('does not consume rate-limit quota for already-aborted requests', async () => {
    for (let i = 0; i < 25; i += 1) {
      const response = await POST(
        buildAbortedEvent({
          spec: validSpec,
          prompt: validPrompt,
          variations: 1,
          outputFormat: 'pdf'
        })
      );
      expect(response.status).toBe(499);
      const payload = await response.json();
      expect(payload.error.code).toBe('IMAGE_ABORTED');
    }
    expect(mockCreateSeam).not.toHaveBeenCalled();
  });

  it('rejects a request that aborts while the body is being parsed before consuming rate-limit quota', async () => {
    const controller = new AbortController();
    lateAbortRef.controller = controller;

    try {
      const response = await POST(
        buildEventWithController(
          { spec: validSpec, prompt: validPrompt, variations: 1, outputFormat: 'pdf' },
          controller
        )
      );
      const payload = await response.json();

      expect(response.status).toBe(499);
      expect(payload.ok).toBe(false);
      expect(payload.error.code).toBe('IMAGE_ABORTED');
      expect(mockCreateSeam).not.toHaveBeenCalled();
    } finally {
      lateAbortRef.controller = null;
    }
  });

  it('does not consume rate-limit quota when aborting while the body is being parsed', async () => {
    try {
      for (let i = 0; i < 25; i += 1) {
        const controller = new AbortController();
        lateAbortRef.controller = controller;
        const response = await POST(
          buildEventWithController(
            { spec: validSpec, prompt: validPrompt, variations: 1, outputFormat: 'pdf' },
            controller
          )
        );
        expect(response.status).toBe(499);
        const payload = await response.json();
        expect(payload.error.code).toBe('IMAGE_ABORTED');
      }
      expect(mockCreateSeam).not.toHaveBeenCalled();
    } finally {
      lateAbortRef.controller = null;
    }
  });

  it('rejects invalid payloads', async () => {
    const response = await POST(buildEvent({ spec: {} }));
    const payload = await response.json();
    expect(response.status).toBe(400);
    expect(payload.ok).toBe(false);
    expect(payload.error.code).toBe('IMAGE_INPUT_INVALID');
  });

  it('does not consume rate-limit quota for schema-invalid payloads', async () => {
    for (let i = 0; i < 25; i += 1) {
      const response = await POST(buildEvent({ spec: {} }));
      expect(response.status).toBe(400);
      const payload = await response.json();
      expect(payload.error.code).toBe('IMAGE_INPUT_INVALID');
    }
    expect(mockCreateSeam).not.toHaveBeenCalled();
  });

  it('rejects prompts exceeding the max length before consuming rate-limit quota', async () => {
    const oversizedPrompt = `${validPrompt} ${'a'.repeat(8000)}`;

    for (let i = 0; i < 25; i += 1) {
      const response = await POST(
        buildEvent({
          spec: validSpec,
          prompt: oversizedPrompt,
          variations: 1,
          outputFormat: 'pdf'
        })
      );
      expect(response.status).toBe(400);
      const payload = await response.json();
      expect(payload.error.code).toBe('IMAGE_INPUT_INVALID');
    }
    expect(mockCreateSeam).not.toHaveBeenCalled();
  });

  it('rejects prompts missing required phrases before calling the seam', async () => {
    const response = await POST(
      buildEvent({
        spec: validSpec,
        prompt: 'a prompt missing the required phrases',
        variations: 1,
        outputFormat: 'pdf'
      })
    );
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload.ok).toBe(false);
    expect(payload.error.code).toBe('PROMPT_MISSING_REQUIRED_PHRASES');
    expect(mockCreateSeam).not.toHaveBeenCalled();
  });

  it('does not consume rate-limit quota for prompts missing required phrases', async () => {
    for (let i = 0; i < 25; i += 1) {
      const response = await POST(
        buildEvent({
          spec: validSpec,
          prompt: 'a prompt missing the required phrases',
          variations: 1,
          outputFormat: 'pdf'
        })
      );
      expect(response.status).toBe(400);
      const payload = await response.json();
      expect(payload.error.code).toBe('PROMPT_MISSING_REQUIRED_PHRASES');
    }
    expect(mockCreateSeam).not.toHaveBeenCalled();
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

  it('returns 503 IMAGE_CONFIG_ERROR without consuming rate-limit quota when provider config is invalid', async () => {
    mockCreateConfigSeam.mockReturnValue({
      getConfig: () => {
        throw new Error('XAI_API_KEY is not set');
      }
    });

    for (let i = 0; i < 25; i += 1) {
      const response = await POST(
        buildEvent({
          spec: validSpec,
          prompt: validPrompt,
          variations: 1,
          outputFormat: 'pdf'
        })
      );
      expect(response.status).toBe(503);
      const payload = await response.json();
      expect(payload.ok).toBe(false);
      expect(payload.error.code).toBe('IMAGE_CONFIG_ERROR');
    }
    expect(mockCreateSeam).not.toHaveBeenCalled();
  });
});
