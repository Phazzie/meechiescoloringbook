// Purpose: Contract tests for provider-neutral WigTryOnSeam fixtures and mocks.
// Why: Enforce deterministic raster output and explicit failure modes before adapter work.
// Info flow: fixture scenarios -> mock seam -> runtime contract assertions.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createWigTryOnSeam } from '../../adapters/wig-try-on-seam';
import { IMAGE_EDIT_MODEL, IMAGE_MODEL } from '../../core/models';
import type {
  ImageProviderConfig,
  ImageProviderConfigSeam
} from '../image-provider-config-seam/contract';
import {
  wigTryOnAbortedErrorFixture,
  wigTryOnConfigErrorFixture,
  wigTryOnEmptyResponseFixture,
  wigTryOnFaultResultFixture,
  wigTryOnHttpErrorFixture,
  wigTryOnNetworkErrorFixture,
  wigTryOnParseErrorFixture,
  wigTryOnRequestFixture,
  wigTryOnTimeoutErrorFixture,
  wigTryOnValidationErrorFixture,
  WIG_TRY_ON_PNG_BASE64
} from './fixtures';
import { createMockWigTryOnSeam, type WigTryOnMockScenario } from './mock';
import { validateWigTryOnRequest, validateWigTryOnResult } from './validators';

const baseImageConfig: ImageProviderConfig = {
  xaiApiKey: 'test-xai-key',
  xaiImageModel: IMAGE_MODEL,
  xaiBaseUrl: 'https://api.x.ai',
  xaiImageEndpointPath: '/v1/images/generations'
};

const createConfigSeam = (
  overrides: Partial<ImageProviderConfig> = {}
): ImageProviderConfigSeam => ({
  getConfig: () => ({ ...baseImageConfig, ...overrides })
});

const jsonResponse = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('WigTryOnSeam mock contract', () => {
  it('tryOn returns a portrait Result on success', async () => {
    const seam = createMockWigTryOnSeam('sample');
    const request = validateWigTryOnRequest(wigTryOnRequestFixture);
    const result = await seam.tryOn(request);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.portraitBase64.length).toBeGreaterThan(0);
    expect(() => validateWigTryOnResult(result.value)).not.toThrow();
  });

  it('returns a supported PNG raster portrait rather than an SVG placeholder', async () => {
    const seam = createMockWigTryOnSeam('sample');
    const result = await seam.tryOn(wigTryOnRequestFixture);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(['image/jpeg', 'image/png', 'image/webp']).toContain(result.value.portraitMimeType);
    const bytes = Buffer.from(result.value.portraitBase64, 'base64');
    expect(bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))).toBe(true);
  });

  it('rejects the checked-in SVG fault result', () => {
    expect(() => validateWigTryOnResult(wigTryOnFaultResultFixture)).toThrow();
  });

  it('rejects unsupported portrait MIME types', () => {
    expect(() =>
      validateWigTryOnResult({
        portraitBase64: 'cG9ydHJhaXQ=',
        portraitMimeType: 'image/gif',
        timingMs: 1
      })
    ).toThrow();
  });

  const failureScenarios: ReadonlyArray<{
    scenario: WigTryOnMockScenario;
    code: string;
  }> = [
    { scenario: 'http_error', code: wigTryOnHttpErrorFixture.code },
    { scenario: 'config_error', code: wigTryOnConfigErrorFixture.code },
    { scenario: 'validation_error', code: wigTryOnValidationErrorFixture.code },
    { scenario: 'network_error', code: wigTryOnNetworkErrorFixture.code },
    { scenario: 'empty_response', code: wigTryOnEmptyResponseFixture.code },
    { scenario: 'parse_error', code: wigTryOnParseErrorFixture.code },
    { scenario: 'timeout_error', code: wigTryOnTimeoutErrorFixture.code },
    { scenario: 'aborted', code: wigTryOnAbortedErrorFixture.code }
  ];

  it.each(failureScenarios)('$scenario returns $code', async ({ scenario, code }) => {
    const seam = createMockWigTryOnSeam(scenario);
    const request = validateWigTryOnRequest(wigTryOnRequestFixture);
    const result = await seam.tryOn(request);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe(code);
  });

  it('portrait base64 is a non-empty string', async () => {
    const seam = createMockWigTryOnSeam('sample');
    const result = await seam.tryOn(wigTryOnRequestFixture);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(typeof result.value.portraitBase64).toBe('string');
    expect(result.value.portraitBase64.length).toBeGreaterThan(0);
  });

  it('rejects an empty image payload before adapter work', () => {
    expect(() =>
      validateWigTryOnRequest({ ...wigTryOnRequestFixture, wigImageBase64: '' })
    ).toThrow();
  });
});

describe('WigTryOnSeam xAI adapter', () => {
  it('posts an ordered two-image edit request with bearer auth and no key in the URL', async () => {
    const fetchImpl = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) =>
      jsonResponse({ data: [{ b64_json: WIG_TRY_ON_PNG_BASE64 }] })
    );
    vi.stubGlobal('fetch', fetchImpl);
    const seam = createWigTryOnSeam(createConfigSeam(), fetchImpl);

    const result = await seam.tryOn(wigTryOnRequestFixture);

    expect(result.ok).toBe(true);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe('https://api.x.ai/v1/images/edits');
    expect(String(url)).not.toContain(baseImageConfig.xaiApiKey);
    expect(init?.headers).toEqual({
      Authorization: `Bearer ${baseImageConfig.xaiApiKey}`,
      'Content-Type': 'application/json'
    });
    const body = JSON.parse(String(init?.body));
    expect(body).toEqual({
      model: IMAGE_EDIT_MODEL,
      prompt: expect.any(String),
      images: [
        {
          type: 'image_url',
          url: `data:${wigTryOnRequestFixture.selfieMimeType};base64,${wigTryOnRequestFixture.selfieBase64}`
        },
        {
          type: 'image_url',
          url: `data:${wigTryOnRequestFixture.wigImageMimeType};base64,${wigTryOnRequestFixture.wigImageBase64}`
        }
      ],
      n: 1,
      response_format: 'b64_json'
    });
    if (!result.ok) return;
    expect(result.value.portraitMimeType).toBe('image/png');
    expect(result.value.portraitBase64).toBe(WIG_TRY_ON_PNG_BASE64);
  });

  it('returns a safe config error without fetching when the xAI key is missing', async () => {
    const fetchImpl = vi.fn();
    const seam = createWigTryOnSeam(createConfigSeam({ xaiApiKey: '' }), fetchImpl);

    const result = await seam.tryOn(wigTryOnRequestFixture);

    expect(result).toEqual({ ok: false, error: wigTryOnConfigErrorFixture });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('returns a safe config error when image config cannot be read', async () => {
    const fetchImpl = vi.fn();
    const configSeam: ImageProviderConfigSeam = {
      getConfig: () => {
        throw new Error('SECRET_CONFIG_DETAIL');
      }
    };
    const seam = createWigTryOnSeam(configSeam, fetchImpl);

    const result = await seam.tryOn(wigTryOnRequestFixture);

    expect(result).toEqual({ ok: false, error: wigTryOnConfigErrorFixture });
    expect(JSON.stringify(result)).not.toContain('SECRET_CONFIG_DETAIL');
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it.each([401, 429, 500])('maps provider HTTP %s without returning its body', async (status) => {
    const fetchImpl = vi.fn(async () => new Response('SECRET_PROVIDER_BODY', { status }));
    const seam = createWigTryOnSeam(createConfigSeam(), fetchImpl);

    const result = await seam.tryOn(wigTryOnRequestFixture);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('WIG_TRY_ON_HTTP_ERROR');
    if (result.error.code !== 'WIG_TRY_ON_HTTP_ERROR') return;
    expect(result.error.details).toEqual({ status: String(status) });
    expect(JSON.stringify(result)).not.toContain('SECRET_PROVIDER_BODY');
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('returns a parse error for malformed success JSON', async () => {
    const fetchImpl = vi.fn(async () => new Response('not-json', { status: 200 }));
    const seam = createWigTryOnSeam(createConfigSeam(), fetchImpl);

    const result = await seam.tryOn(wigTryOnRequestFixture);

    expect(result).toEqual({ ok: false, error: wigTryOnParseErrorFixture });
  });

  it('returns an empty-response error when b64_json is missing', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ data: [{}] }));
    const seam = createWigTryOnSeam(createConfigSeam(), fetchImpl);

    const result = await seam.tryOn(wigTryOnRequestFixture);

    expect(result).toEqual({ ok: false, error: wigTryOnEmptyResponseFixture });
  });

  it('rejects base64 that does not decode to a supported raster image', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ data: [{ b64_json: 'bm90LWEtcmFzdGVy' }] }));
    const seam = createWigTryOnSeam(createConfigSeam(), fetchImpl);

    const result = await seam.tryOn(wigTryOnRequestFixture);

    expect(result).toEqual({ ok: false, error: wigTryOnParseErrorFixture });
  });

  it('does not fetch when the caller signal is already aborted', async () => {
    const controller = new AbortController();
    controller.abort();
    const fetchImpl = vi.fn();
    const seam = createWigTryOnSeam(createConfigSeam(), fetchImpl);

    const result = await seam.tryOn({ ...wigTryOnRequestFixture, signal: controller.signal });

    expect(result).toEqual({ ok: false, error: wigTryOnAbortedErrorFixture });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('maps response-body timeouts distinctly from parse errors', async () => {
    const timeout = Object.assign(new Error('SECRET_TIMEOUT_DETAIL'), { name: 'TimeoutError' });
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: vi.fn().mockRejectedValue(timeout)
    } as unknown as Response));
    const seam = createWigTryOnSeam(createConfigSeam(), fetchImpl);

    const result = await seam.tryOn(wigTryOnRequestFixture);

    expect(result).toEqual({ ok: false, error: wigTryOnTimeoutErrorFixture });
    expect(JSON.stringify(result)).not.toContain('SECRET_TIMEOUT_DETAIL');
  });

  it('maps HTTP-body timeouts distinctly from provider HTTP errors', async () => {
    const timeout = Object.assign(new Error('SECRET_HTTP_TIMEOUT'), { name: 'TimeoutError' });
    const fetchImpl = vi.fn(async () => ({
      ok: false,
      status: 429,
      text: vi.fn().mockRejectedValue(timeout)
    } as unknown as Response));
    const seam = createWigTryOnSeam(createConfigSeam(), fetchImpl);

    const result = await seam.tryOn(wigTryOnRequestFixture);

    expect(result).toEqual({ ok: false, error: wigTryOnTimeoutErrorFixture });
    expect(JSON.stringify(result)).not.toContain('SECRET_HTTP_TIMEOUT');
  });

  it('maps thrown network details to a stable message', async () => {
    const fetchImpl = vi.fn(async () => {
      throw new Error('https://api.x.ai/v1/images/edits?key=SECRET_QUERY_KEY');
    });
    const seam = createWigTryOnSeam(createConfigSeam(), fetchImpl);

    const result = await seam.tryOn(wigTryOnRequestFixture);

    expect(result).toEqual({ ok: false, error: wigTryOnNetworkErrorFixture });
    expect(JSON.stringify(result)).not.toContain('SECRET_QUERY_KEY');
  });
});
