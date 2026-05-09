/*
Purpose: Implement ImageGenerationSeam using ProviderAdapterSeam.
Why: Keep image-generation network I/O isolated behind a Result-based seam contract.
Info flow: request -> provider adapter -> normalized image-generation Result.
*/
import { createProviderAdapter } from '../../adapters/provider-adapter.adapter';
import type { ProviderAdapterSeam } from '../../../../contracts/provider-adapter.contract';
import type { Result } from '../../../../contracts/shared.contract';
import { SYSTEM_CONSTANTS } from '$lib/core/constants';
import {
imageGenerationResultSchema,
type ImageGenerationOutput,
type ImageGenerationRequest,
type ImageGenerationSeam
} from '../../seams/image-generation-seam/contract';
import { imageGenerationRequestSchema } from '../../seams/image-generation-seam/contract';

const REQUIRED_PHRASES = SYSTEM_CONSTANTS.REQUIRED_PROMPT_PHRASES;
const DEFAULT_IMAGE_MODEL = 'grok-imagine-image';
const RESPONSE_FORMAT = 'b64_json';

const pageSizeLine = (pageSize: ImageGenerationRequest['spec']['pageSize']): string =>
pageSize === 'A4' ? 'A4 8.27x11.69 portrait.' : 'US Letter 8.5x11 portrait.';

const missingRequiredPhrases = (
prompt: string,
pageSize: ImageGenerationRequest['spec']['pageSize']
): string[] => {
const promptLower = prompt.toLowerCase();
const phrases = [...REQUIRED_PHRASES, pageSizeLine(pageSize)].map((phrase) => phrase.toLowerCase());
return phrases.filter((phrase) => !promptLower.includes(phrase));
};

const imageFormatFromBase64 = (data: string): { format: 'jpg' | 'png'; mimeType: string } =>
data.startsWith('/9j/')
? { format: 'jpg', mimeType: 'image/jpeg' }
: { format: 'png', mimeType: 'image/png' };

type ImageGenerationSeamDeps = {
createProvider?: () => ProviderAdapterSeam;
model?: string;
};

const parseInput = (
request: unknown
): Result<ImageGenerationRequest> => {
const parsed = imageGenerationRequestSchema.safeParse(request);
if (!parsed.success) {
return {
ok: false,
error: {
code: 'IMAGE_INPUT_INVALID',
message: 'Image generation input is invalid.'
}
};
}
return { ok: true, value: parsed.data };
};

export const createImageGenerationSeam = (
deps: ImageGenerationSeamDeps = {}
): ImageGenerationSeam => {
const createProvider = deps.createProvider ?? (() => createProviderAdapter({}));
const model = deps.model ?? DEFAULT_IMAGE_MODEL;

return {
generate: async (
request: ImageGenerationRequest
): Promise<Result<ImageGenerationOutput>> => {
const parsedInput = parseInput(request);
if (!parsedInput.ok) {
return parsedInput;
}

const missing = missingRequiredPhrases(
parsedInput.value.prompt,
parsedInput.value.spec.pageSize
);
if (missing.length > 0) {
return {
ok: false,
error: {
code: 'PROMPT_MISSING_REQUIRED_PHRASES',
message: 'Prompt missing required phrases for deterministic generation.'
}
};
}

const provider = createProvider();
const providerResult = await provider.createImageGeneration({
model,
prompt: parsedInput.value.prompt,
n: parsedInput.value.variations,
responseFormat: RESPONSE_FORMAT
});
if (!providerResult.ok) {
return providerResult;
}

const images = providerResult.value.images
.map((image, index) => {
if (!image.b64_json) {
return null;
}
const format = imageFormatFromBase64(image.b64_json);
return {
id: `image-${index + 1}`,
...format,
data: image.b64_json,
encoding: 'base64' as const
};
})
.filter((image): image is NonNullable<typeof image> => image !== null);

if (images.length === 0) {
return {
ok: false,
error: {
code: 'PROVIDER_EMPTY_IMAGE',
message: 'Provider returned no images.'
}
};
}

const result: Result<ImageGenerationOutput> = {
ok: true,
value: {
images,
revisedPrompt: providerResult.value.revisedPrompt,
modelMetadata: {
provider: 'xai',
model
}
}
};

const parsedResult = imageGenerationResultSchema.safeParse(result);
if (!parsedResult.success) {
return {
ok: false,
error: {
code: 'IMAGE_OUTPUT_INVALID',
message: 'Image generation response did not match contract.'
}
};
}

return parsedResult.data;
}
};
};
