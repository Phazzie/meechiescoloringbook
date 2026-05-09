// Purpose: Centralize image-generation endpoint orchestration in a reusable core pipeline.
// Why: Keep route handlers thin while delegating image I/O to the self-contained ImageGenerationSeam adapter.
// Info flow: Raw request body -> contract validation -> seam call -> HTTP status/result mapping.
import {
ImageGenerationInputSchema,
ImageGenerationResultSchema
} from '../../../contracts/image-generation.contract';
import type { ImageGenerationSeam } from '$lib/seams/image-generation-seam/contract';
import { createImageGenerationSeam } from '$lib/adapters/image-generation-seam';

export type ImagePipelineResponse = {
status: number;
body: ReturnType<typeof ImageGenerationResultSchema.parse>;
};

type ImagePipelineDeps = {
createImageSeam: () => ImageGenerationSeam;
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

const statusForErrorCode = (code: string): number => {
switch (code) {
case 'IMAGE_INPUT_INVALID':
case 'PROMPT_MISSING_REQUIRED_PHRASES':
return 400;
case 'PROVIDER_API_KEY_MISSING':
return 401;
default:
return 502;
}
};

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

const seam = deps.createImageSeam();
const seamResult = await seam.generate(parsedInput.data);
if (!seamResult.ok) {
const status = statusForErrorCode(seamResult.error.code);
const message =
seamResult.error.code === 'PROVIDER_API_KEY_MISSING'
? 'Image generation requires XAI_API_KEY to be set on the server.'
: seamResult.error.message;
return {
status,
body: {
ok: false,
error: {
...seamResult.error,
message
}
}
};
}

const parsedResult = ImageGenerationResultSchema.safeParse(seamResult);
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

export const imageGenerationPipelineDeps: ImagePipelineDeps = {
createImageSeam: () => createImageGenerationSeam()
};
