// Purpose: Implement ImageGenerationSeam with live xAI HTTP calls.
// Why: Isolate network I/O behind the seam contract.
// Info flow: validated request -> fetch -> seam output.
import type {
  GeneratedImage,
  ImageGenerationRequest,
  ImageGenerationResult,
  ImageGenerationSeam
} from '../../seams/image-generation-seam/contract';
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
  `${request.prompt}\n\nNegative prompt: ${request.negativePrompt}`;

export const createImageGenerationSeam = (configSeam: AppConfigSeam): ImageGenerationSeam => ({
  generate: async (request) => {
    const validated = validateImageGenerationRequest(request);
    const config = configSeam.getConfig();
    const url = buildUrl(config.xaiBaseUrl, config.xaiImageEndpointPath);
    const start = Date.now();

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
      })
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`xAI image generation failed: ${response.status} ${text}`);
    }

    const payload = (await response.json()) as XaiImageResponse;
    const images: GeneratedImage[] = payload.data.map((item, index) => ({
      id: `xai-${index + 1}`,
      url: item.url,
      b64: item.b64_json
    }));

    return {
      images,
      rawModelInfo: {
        revisedPrompt: payload.data[0]?.revised_prompt,
        requestedSize: validated.size,
        responseFormat: validated.format
      },
      timingMs: Date.now() - start
    } satisfies ImageGenerationResult;
  }
});
