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

const decodeBase64ToUtf8 = (b64: string): string => {
  try {
    if (typeof Buffer !== 'undefined') {
      return Buffer.from(b64, 'base64').toString('utf8');
    }
    const binary = atob(b64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return new TextDecoder().decode(bytes);
  } catch (error) {
    console.error('decodeBase64ToUtf8: failed to decode base64 string', error);
    return '';
  }
};

// Matches SVG text that may be preceded by a BOM, an XML declaration, comments, and/or a doctype.
// The comment body uses a negative-lookahead-per-character form instead of a lazy `[\s\S]*?` so
// each comment has exactly one possible parse; combined with the outer repetition, the lazy form
// let the engine backtrack over many equivalent splits of repeated "--><!--" runs (CodeQL-flagged
// exponential backtracking / ReDoS).
const SVG_TEXT_PATTERN = new RegExp(
  '^[\\s\\uFEFF]*(?:<\\?xml\\b[^>]*\\?>[\\s\\uFEFF]*)?' +
    '(?:<!--(?:(?!-->)[\\s\\S])*-->[\\s\\uFEFF]*)*(?:<!doctype[^>]*>[\\s\\uFEFF]*)?<svg\\b',
  'i'
);

// The pattern above is already linear-time (verified empirically up to 700KB of pathological
// input), but capping the slice it runs against keeps regex cost bounded regardless of payload
// size; a real SVG's opening prologue never needs anywhere near this many characters.
const SVG_SNIFF_LENGTH = 2048;

type DetectedImage = Pick<GeneratedImage, 'format' | 'mimeType' | 'data' | 'encoding'>;

const detectImageFromBase64 = (b64: string): DetectedImage => {
  if (b64.startsWith('/9j/')) return { format: 'jpg', mimeType: 'image/jpeg', data: b64, encoding: 'base64' };
  if (b64.startsWith('iVBORw0KGgo')) return { format: 'png', mimeType: 'image/png', data: b64, encoding: 'base64' };
  if (b64.startsWith('UklGR')) return { format: 'webp', mimeType: 'image/webp', data: b64, encoding: 'base64' };

  const decoded = decodeBase64ToUtf8(b64);
  if (SVG_TEXT_PATTERN.test(decoded.slice(0, SVG_SNIFF_LENGTH))) {
    return { format: 'svg', mimeType: 'image/svg+xml', data: decoded, encoding: 'utf8' };
  }

  console.warn('detectImageFromBase64: unrecognized header, defaulting to png');
  return { format: 'png', mimeType: 'image/png', data: b64, encoding: 'base64' };
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
    const statusByCode: Record<string, number> = {
      IMAGE_ABORTED: 499,
      IMAGE_TIMEOUT_ERROR: 504,
      IMAGE_CONFIG_ERROR: 503,
      IMAGE_VALIDATION_ERROR: 400
    };
    return {
      status: statusByCode[seamResult.error.code] ?? 502,
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
    const detected = detectImageFromBase64(image.b64);
    images.push({ id: `image-${index + 1}`, ...detected });
  }

  if (images.length === 0) {
    return buildError(
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
