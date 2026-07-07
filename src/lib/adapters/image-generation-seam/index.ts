// Purpose: Implement ImageGenerationSeam with live xAI HTTP calls.
// Why: Isolate network I/O behind the seam contract.
// Info flow: validated request -> fetch -> Result.
import type {
  GeneratedImage,
  ImageGenerationError,
  ImageGenerationRequest,
  ImageGenerationResult,
  ImageGenerationSeam
} from '../../seams/image-generation-seam/contract';
import type { Result } from '../../../../contracts/shared.contract';
import {
  NEGATIVE_PROMPT_SEPARATOR,
  validateImageGenerationRequest
} from '../../seams/image-generation-seam/validators';
import type { ImageProviderConfig, ImageProviderConfigSeam } from '../../seams/image-provider-config-seam/contract';
import {
  createCircuitBreaker,
  isAbortError,
  isTimeoutError,
  runWithTimeoutSignal,
  RETRYABLE_STATUSES
} from '$lib/core/http-resilience';

type XaiImageResponse = {
  data: Array<{
    url?: string;
    b64_json?: string;
    revised_prompt?: string;
  }>;
};

type XaiReadResult =
  | { kind: 'ok'; payload: XaiImageResponse }
  | { kind: 'http_error'; status: number; text: string }
  | { kind: 'parse_error' };

const XAI_IMAGE_TIMEOUT_MS = 120_000;
// Module-scope (not per-factory-call) so the breaker state survives across the per-request
// createImageGenerationSeam(configSeam) instances the route creates — otherwise every request
// would start with a fresh closed breaker and an outage would never trip fail-fast.
const CIRCUIT_BREAKER_OPTIONS = { failureThreshold: 3, cooldownMs: 30_000 } as const;
const breaker = createCircuitBreaker(CIRCUIT_BREAKER_OPTIONS);
const CIRCUIT_OPEN_MESSAGE = 'xAI image generation is temporarily unavailable after repeated errors; failing fast.';

// Exported so routes can skip charging rate-limit quota for a request that is about to fail
// fast anyway — see checkImageGenerationCircuitOpen in image-generation-pipeline.ts. Reads the
// same module-scope breaker this file's own generate() call guards itself with.
export const isImageGenerationCircuitOpen = (): boolean => breaker.isOpen();

const buildUrl = (baseUrl: string, path: string) => {
  const normalizedBase = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
  const normalizedPath = path.startsWith('/') ? path.slice(1) : path;
  return new URL(normalizedPath, normalizedBase).toString();
};

const buildPrompt = (request: ImageGenerationRequest) =>
  request.negativePrompt
    ? `${request.prompt}${NEGATIVE_PROMPT_SEPARATOR}${request.negativePrompt}`
    : request.prompt;

const errorResult = (
  code: ImageGenerationError['code'],
  message: string,
  details?: Record<string, string>
): Result<ImageGenerationResult, ImageGenerationError> => ({
  ok: false,
  error: { code, message, ...(details ? { details } : {}) } as ImageGenerationError
});

export const createImageGenerationSeam = (configSeam: ImageProviderConfigSeam): ImageGenerationSeam => ({
  generate: async (request): Promise<Result<ImageGenerationResult, ImageGenerationError>> => {
    const callerSignal = request.signal;
    if (callerSignal?.aborted) {
      return errorResult('IMAGE_ABORTED', 'Image generation request was canceled by the caller.');
    }

    let validated: ImageGenerationRequest;
    try {
      validated = validateImageGenerationRequest(request);
    } catch {
      return errorResult('IMAGE_VALIDATION_ERROR', 'Image generation request failed validation.');
    }

    let config: ImageProviderConfig;
    try {
      config = configSeam.getConfig();
    } catch {
      // IMAGE_CONFIG_ERROR: config/env validation failure (distinct from request validation).
      return errorResult(
        'IMAGE_CONFIG_ERROR',
        'Image generation configuration is invalid. Ensure XAI_API_KEY and related environment variables are set.'
      );
    }

    if (breaker.isOpen()) {
      return errorResult('IMAGE_CIRCUIT_OPEN', CIRCUIT_OPEN_MESSAGE);
    }

    const url = buildUrl(config.xaiBaseUrl, config.xaiImageEndpointPath);
    const start = Date.now();

    // Tracks whether the breaker was already updated from the HTTP response status, so the
    // catch block below only records a failure for a genuine transport/timeout error — not
    // for an exception thrown while parsing or normalizing an already-received response.
    let breakerRecorded = false;
    let readResult: XaiReadResult;
    try {
      readResult = await runWithTimeoutSignal(
        async (signal): Promise<XaiReadResult> => {
          const response = await fetch(url, {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${config.xaiApiKey}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              model: config.xaiImageModel,
              prompt: buildPrompt(validated),
              n: validated.n,
              response_format: validated.format
            }),
            signal
          });

          if (RETRYABLE_STATUSES.has(response.status)) {
            breaker.recordFailure();
            breakerRecorded = true;
          }
          // For 2xx and non-retryable 4xx alike: defer success recording until after the body
          // is fully read, so a body-stall timeout on either path reaches the outer catch as a
          // recordable failure instead of being masked by an already-true breakerRecorded flag
          // set purely from the HTTP status line.

          if (!response.ok) {
            // Any error here (not just abort/timeout) is a genuine network/stream failure —
            // e.g. a connection dropping mid-transfer — and must propagate to the outer catch
            // to be recorded as a failure, not be swallowed into a false "http_error" success.
            const text = await response.text();
            // Non-retryable HTTP error (e.g. 400, 401): only mark success once the body has
            // actually been read — upstream is reachable and responded, not just present. A
            // retryable status already recorded its failure above and must not have it
            // overwritten by a success from reaching this same body-read step.
            if (!breakerRecorded) {
              breaker.recordSuccess();
              breakerRecorded = true;
            }
            return { kind: 'http_error', status: response.status, text };
          }

          try {
            const payload = (await response.json()) as XaiImageResponse;
            breaker.recordSuccess();
            breakerRecorded = true;
            return { kind: 'ok', payload };
          } catch (error) {
            // Only malformed-but-reachable JSON (SyntaxError) is a "parse error" success; any
            // other error (stream termination, abort, timeout) is a genuine failure and must
            // propagate to the outer catch instead of being recorded as a success here.
            if (error instanceof SyntaxError) {
              breaker.recordSuccess();
              breakerRecorded = true;
              return { kind: 'parse_error' };
            }
            throw error;
          }
        },
        XAI_IMAGE_TIMEOUT_MS,
        {
          signal: callerSignal,
          timeoutMessage: `xAI image generation timed out after ${XAI_IMAGE_TIMEOUT_MS / 1000} seconds.`
        }
      );
    } catch (error) {
      if (!breakerRecorded && !isAbortError(error)) {
        breaker.recordFailure();
      }
      if (isTimeoutError(error)) {
        return errorResult('IMAGE_TIMEOUT_ERROR', 'xAI image generation timed out.');
      }
      if (isAbortError(error)) {
        return errorResult('IMAGE_ABORTED', 'Image generation request was canceled by the caller.');
      }
      return errorResult(
        'IMAGE_NETWORK_ERROR',
        error instanceof Error ? error.message : 'Image generation network request failed.'
      );
    }

    if (readResult.kind === 'http_error') {
      return errorResult('IMAGE_HTTP_ERROR', `xAI image generation failed: ${readResult.status}${readResult.text ? ` ${readResult.text}` : ''}`, {
        status: String(readResult.status)
      });
    }

    if (readResult.kind === 'parse_error') {
      return errorResult('IMAGE_NETWORK_ERROR', 'Failed to parse xAI image generation response.');
    }

    // Null safety: handle cases where payload.data is null or missing.
    const images: GeneratedImage[] = (readResult.payload.data || []).map((item, index) => ({
      id: `xai-${index + 1}`,
      url: item.url,
      b64: item.b64_json
    }));

    if (images.length === 0) {
      return errorResult('IMAGE_EMPTY_RESPONSE', 'xAI returned no images.');
    }

    return {
      ok: true,
      value: {
        images,
        rawModelInfo: {
          model: config.xaiImageModel,
          revisedPrompt: readResult.payload.data[0]?.revised_prompt,
          requestedSize: validated.size,
          responseFormat: validated.format
        },
        timingMs: Date.now() - start
      }
    };
  }
});
