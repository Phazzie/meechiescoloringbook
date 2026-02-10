// Purpose: Orchestrate the generation workflow across seams.
// Why: Keep core logic deterministic and seam-driven.
// Info flow: user request -> safety/prompt/image -> gallery/telemetry.
import type { ImageGenerationRequest } from '../seams/image-generation-seam/contract';
import type { GalleryRecord } from '../seams/gallery-store-seam/contract';
import type { GenerationDependencies, GenerationWorkflowResult, UserRequest } from './types';

export const runGenerationWorkflow = async (
  input: UserRequest,
  deps: GenerationDependencies
): Promise<GenerationWorkflowResult> => {
  const startTime = Date.now();
  deps.telemetrySeam.emit({
    name: 'generation_requested',
    timestamp: new Date().toISOString(),
    metadata: { glamLevel: input.glamLevel }
  });

  const safetyRequest = deps.safetyPolicySeam.validateUserRequest(input);
  if (!safetyRequest.ok) {
    deps.telemetrySeam.emit({
      name: 'generation_failed',
      timestamp: new Date().toISOString(),
      metadata: { stage: 'user_validation', reason: safetyRequest.error.code }
    });

    return {
      ok: false,
      error: {
        stage: 'user_validation',
        details: safetyRequest.error
      }
    };
  }

  const compiled = await deps.promptCompilerSeam.compile(input);
  const safetyCompiled = deps.safetyPolicySeam.validateCompiledPrompt(compiled);
  if (!safetyCompiled.ok) {
    deps.telemetrySeam.emit({
      name: 'generation_failed',
      timestamp: new Date().toISOString(),
      metadata: { stage: 'compiled_validation', reason: safetyCompiled.error.code }
    });

    return {
      ok: false,
      error: {
        stage: 'compiled_validation',
        details: safetyCompiled.error
      }
    };
  }

  const config = deps.appConfigSeam.getConfig();
  const imageRequest: ImageGenerationRequest = {
    prompt: compiled.imagePrompt,
    negativePrompt: compiled.negativePrompt,
    n: 1,
    size: config.defaultImageSize,
    format: 'url'
  };

  try {
    const result = await deps.imageGenerationSeam.generate(imageRequest);
    const record: GalleryRecord = {
      id: `record-${Date.now()}`,
      createdAt: new Date().toISOString(),
      request: input,
      compiled,
      images: result.images
    };

    await deps.galleryStoreSeam.save(record);

    deps.telemetrySeam.emit({
      name: 'generation_succeeded',
      timestamp: new Date().toISOString(),
      metadata: { timingMs: Date.now() - startTime }
    });

    return {
      ok: true,
      data: {
        compiled,
        images: result.images,
        record
      }
    };
  } catch (error) {
    deps.telemetrySeam.emit({
      name: 'generation_failed',
      timestamp: new Date().toISOString(),
      metadata: { stage: 'image_generation' }
    });

    return {
      ok: false,
      error: {
        stage: 'image_generation',
        details: error instanceof Error ? error.message : 'Unknown error'
      }
    };
  }
};
