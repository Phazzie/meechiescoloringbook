// Purpose: Centralize image-generation endpoint orchestration in a reusable core pipeline.
// Why: Keep route handlers thin and make validation/provider behavior easier to test.
// Info flow: Raw request body -> validation -> ImageGenerationSeam -> contract-shaped response.
import { SYSTEM_CONSTANTS } from '$lib/core/constants';
import { pageSizeLine } from '$lib/core/prompt-template';
import { z } from 'zod';
import {
  ImageGenerationInputSchema,
  ImageGenerationResultSchema,
  type GeneratedImage
} from '../../../contracts/image-generation.contract';
import type { PageSize } from '../../../contracts/spec-validation.contract';
import type { ImageGenerationSeam } from '$lib/seams/image-generation-seam/contract';

const RESPONSE_FORMAT = 'b64_json' as const;
const DEFAULT_IMAGE_SIZE = '1024x1024';
const REQUIRED_PHRASES = SYSTEM_CONSTANTS.REQUIRED_PROMPT_PHRASES;

const STATUS_BY_ERROR_CODE: Record<string, number> = {
  IMAGE_ABORTED: 499,
  IMAGE_TIMEOUT_ERROR: 504,
  IMAGE_CONFIG_ERROR: 503,
  IMAGE_VALIDATION_ERROR: 400
};

const imageFormatFromBase64 = (
  data: string
): Pick<GeneratedImage, 'format' | 'mimeType'> => {
  if (data.startsWith('/9j/')) return { format: 'jpg', mimeType: 'image/jpeg' };
  if (data.startsWith('iVBORw0KGgo')) return { format: 'png', mimeType: 'image/png' };
  if (import.meta.env.DEV) console.warn('imageFormatFromBase64: unrecognized header, defaulting to png');
  return { format: 'png', mimeType: 'image/png' };
};

type ImageGenerationResult = z.infer<typeof ImageGenerationResultSchema>;

type ImagePipelineResponse = {
  status: number;
  body: ImageGenerationResult;
};

export type ImagePipelineDeps = {
  imageGenerationSeam: ImageGenerationSeam;
  signal?: AbortSignal;
};

const missingRequiredPhrases = (prompt: string, pageSize: PageSize): string[] => {
  const promptLower = prompt.toLowerCase();
  const phrases = [...REQUIRED_PHRASES, pageSizeLine(pageSize)];
  return phrases.filter((phrase) => !promptLower.includes(phrase.toLowerCase()));
};

const extractImageMetadata = (
  rawModelInfo: Record<string, unknown>
): { revisedPrompt: string | undefined; model: string } => ({
  revisedPrompt: typeof rawModelInfo.revisedPrompt === 'string' ? rawModelInfo.revisedPrompt : undefined,
  model: typeof rawModelInfo.model === 'string' ? rawModelInfo.model : 'unknown'
});

const buildError = (
  status: number,
  code: string,
  message: string
): ImagePipelineResponse => ({
  status,
  body: {
    ok: false,
    error: {
      code,
      message
    }
  }
});

export const runImageGenerationPipeline = async (
  body: unknown,
  deps: ImagePipelineDeps
): Promise<ImagePipelineResponse> => {
  if (deps.signal?.aborted) {
    return buildError(
      499,
      'IMAGE_ABORTED',
      'Image generation request was canceled by the caller.'
    );
  }

  const parsedInput = ImageGenerationInputSchema.safeParse(body);
  if (!parsedInput.success) {
    return buildError(
      400,
      'IMAGE_INPUT_INVALID',
      'Image generation input is invalid.'
    );
  }

  const { prompt, variations, spec } = parsedInput.data;
  const missing = missingRequiredPhrases(prompt, spec.pageSize);
  if (missing.length > 0) {
    return buildError(
      400,
      'PROMPT_MISSING_REQUIRED_PHRASES',
      `Prompt missing required phrases (case-insensitive checks, normalized): ${missing.join(', ')}`
    );
  }

  const seamResult = await deps.imageGenerationSeam.generate({
    prompt,
    n: variations,
    size: DEFAULT_IMAGE_SIZE,
    format: RESPONSE_FORMAT,
    signal: deps.signal
  });

  if (!seamResult.ok) {
    return {
      status: STATUS_BY_ERROR_CODE[seamResult.error.code] ?? 502,
      body: {
        ok: false,
        error: seamResult.error
      }
    };
  }

  const images: GeneratedImage[] = [];
  for (const [index, image] of seamResult.value.images.entries()) {
    if (!image.b64) {
      continue;
    }
    const format = imageFormatFromBase64(image.b64);
    images.push({
      id: `image-${index + 1}`,
      ...format,
      data: image.b64,
      encoding: 'base64'
    });
  }

  if (images.length === 0) {
    return buildError(
      502,
      'PROVIDER_EMPTY_IMAGE',
      'Provider returned no images.'
    );
  }

  const { revisedPrompt, model } = extractImageMetadata(seamResult.value.rawModelInfo);

  const result: ImageGenerationResult = {
    ok: true,
    value: {
      images,
      revisedPrompt,
      modelMetadata: {
        provider: 'xai',
        model
      }
    }
  };

  const parsedResult = ImageGenerationResultSchema.safeParse(result);
  if (!parsedResult.success) {
    return buildError(
      500,
      'IMAGE_OUTPUT_INVALID',
      'Image generation response did not match contract.'
    );
  }

  return {
    status: 200,
    body: parsedResult.data
  };
};
