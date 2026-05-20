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

const imageFormatFromBase64 = (
  data: string
): Pick<GeneratedImage, 'format' | 'mimeType'> =>
  data.startsWith('/9j/')
    ? { format: 'jpg', mimeType: 'image/jpeg' }
    : { format: 'png', mimeType: 'image/png' };

type ImageGenerationResult = z.infer<typeof ImageGenerationResultSchema>;

type ImagePipelineResponse = {
  status: number;
  body: ImageGenerationResult;
};

export type ImagePipelineDeps = {
  imageGenerationSeam: ImageGenerationSeam;
};

const missingRequiredPhrases = (prompt: string, pageSize: PageSize): string[] => {
  const promptLower = prompt.toLowerCase();
  const phrases = [...REQUIRED_PHRASES, pageSizeLine(pageSize)].map((phrase) =>
    phrase.toLowerCase()
  );
  return phrases.filter((phrase) => !promptLower.includes(phrase));
};

const errorResponse = (
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
  const parsedInput = ImageGenerationInputSchema.safeParse(body);
  if (!parsedInput.success) {
    return errorResponse(
      400,
      'IMAGE_INPUT_INVALID',
      'Image generation input is invalid.'
    );
  }

  const { prompt, variations, spec } = parsedInput.data;
  const missing = missingRequiredPhrases(prompt, spec.pageSize);
  if (missing.length > 0) {
    return errorResponse(
      400,
      'PROMPT_MISSING_REQUIRED_PHRASES',
      'Prompt missing required phrases for deterministic generation.'
    );
  }

  const seamResult = await deps.imageGenerationSeam.generate({
    prompt,
    n: variations,
    size: DEFAULT_IMAGE_SIZE,
    format: RESPONSE_FORMAT
  });

  if (!seamResult.ok) {
    const isConfigError = seamResult.error.code === 'IMAGE_CONFIG_ERROR';
    return {
      status: isConfigError ? 503 : 502,
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
    return errorResponse(
      502,
      'PROVIDER_EMPTY_IMAGE',
      'Provider returned no images.'
    );
  }

  const revisedPrompt =
    typeof seamResult.value.rawModelInfo.revisedPrompt === 'string'
      ? seamResult.value.rawModelInfo.revisedPrompt
      : undefined;

  const result: ImageGenerationResult = {
    ok: true,
    value: {
      images,
      revisedPrompt,
      modelMetadata: {
        provider: 'xai',
        model:
          typeof seamResult.value.rawModelInfo.model === 'string'
            ? seamResult.value.rawModelInfo.model
            : 'unknown'
      }
    }
  };

  const parsedResult = ImageGenerationResultSchema.safeParse(result);
  if (!parsedResult.success) {
    return errorResponse(
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
