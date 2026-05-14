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
import type { AppConfigSeam } from '../../seams/app-config-seam/contract';

type XaiImageResponse = {
  data: Array<{
    url?: string;
    b64_json?: string;
    revised_prompt?: string;
  }>;
};

const buildUrl = (baseUrl: string, path: string) => {
  const normalizedBase = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
  const normalizedPath = path.startsWith('/') ? path.slice(1) : path;
  return new URL(normalizedPath, normalizedBase).toString();
};

const buildPrompt = (request: ImageGenerationRequest) =>
  request.negativePrompt
    ? `${request.prompt}\n\nNegative prompt: ${request.negativePrompt}`
    : request.prompt;

const errorResult = (error: ImageGenerationError): Result<ImageGenerationResult, ImageGenerationError> => ({
  ok: false,
  error
});

export const createImageGenerationSeam = (configSeam: AppConfigSeam): ImageGenerationSeam => ({
  generate: async (request): Promise<Result<ImageGenerationResult, ImageGenerationError>> => {
    let validated: ImageGenerationRequest;
    try {
      validated = validateImageGenerationRequest(request);
    } catch {
      return errorResult({ code: 'IMAGE_VALIDATION_ERROR', message: 'Image generation request failed validation.' });
    }

    let config: ReturnType<typeof configSeam.getConfig>;
    try {
      config = configSeam.getConfig();
    } catch {
      // IMAGE_CONFIG_ERROR: config/env validation failure (distinct from request validation).
      return errorResult({
        code: 'IMAGE_CONFIG_ERROR',
        message: 'Image generation configuration is invalid. Ensure XAI_API_KEY and related environment variables are set.'
      });
    }

    const url = buildUrl(config.xaiBaseUrl, config.xaiImageEndpointPath);
    const start = Date.now();

    let response: Response;
    try {
      response = await fetch(url, {
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
        })
      });
    } catch (error) {
      return errorResult({
        code: 'IMAGE_NETWORK_ERROR',
        message: error instanceof Error ? error.message : 'Image generation network request failed.'
      });
    }

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      return errorResult({
        code: 'IMAGE_HTTP_ERROR',
        message: `xAI image generation failed: ${response.status}${text ? ` ${text}` : ''}`,
        details: { status: String(response.status) }
      });
    }

    let payload: XaiImageResponse;
    try {
      payload = (await response.json()) as XaiImageResponse;
    } catch {
      return errorResult({ code: 'IMAGE_NETWORK_ERROR', message: 'Failed to parse xAI image generation response.' });
    }

    // Null safety: handle cases where payload.data is null or missing.
    const images: GeneratedImage[] = (payload.data || []).map((item, index) => ({
      id: `xai-${index + 1}`,
      url: item.url,
      b64: item.b64_json
    }));

    if (images.length === 0) {
      return errorResult({ code: 'IMAGE_EMPTY_RESPONSE', message: 'xAI returned no images.' });
    }

    return {
      ok: true,
      value: {
        images,
        rawModelInfo: {
          model: config.xaiImageModel,
          revisedPrompt: payload.data[0]?.revised_prompt,
          requestedSize: validated.size,
          responseFormat: validated.format
        },
        timingMs: Date.now() - start
      }
    };
  }
});
