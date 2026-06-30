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
import { validateImageGenerationRequest } from '../../seams/image-generation-seam/validators';
import type { ImageProviderConfig, ImageProviderConfigSeam } from '../../seams/image-provider-config-seam/contract';
import { isAbortError, isTimeoutError, runWithTimeoutSignal } from '$lib/core/http-resilience';

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

const buildUrl = (baseUrl: string, path: string) => {
  const normalizedBase = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
  const normalizedPath = path.startsWith('/') ? path.slice(1) : path;
  return new URL(normalizedPath, normalizedBase).toString();
};

const buildPrompt = (request: ImageGenerationRequest) =>
  request.negativePrompt
    ? `${request.prompt}\n\nNegative prompt: ${request.negativePrompt}`
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

    const url = buildUrl(config.xaiBaseUrl, config.xaiImageEndpointPath);
    const start = Date.now();

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

          if (!response.ok) {
            let text = '';
            try {
              text = await response.text();
            } catch (error) {
              if (isAbortError(error) || isTimeoutError(error)) throw error;
            }
            return { kind: 'http_error', status: response.status, text };
          }

          try {
            return { kind: 'ok', payload: (await response.json()) as XaiImageResponse };
          } catch (error) {
            if (isAbortError(error) || isTimeoutError(error)) throw error;
            return { kind: 'parse_error' };
          }
        },
        XAI_IMAGE_TIMEOUT_MS,
        {
          signal: callerSignal,
          timeoutMessage: `xAI image generation timed out after ${XAI_IMAGE_TIMEOUT_MS / 1000} seconds.`
        }
      );
    } catch (error) {
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
          revisedPrompt: readResult.payload.data?.[0]?.revised_prompt,
          requestedSize: validated.size,
          responseFormat: validated.format
        },
        timingMs: Date.now() - start
      }
    };
  }
});
