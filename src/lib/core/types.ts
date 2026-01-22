import type { AppConfigSeam } from '../seams/app-config-seam/contract';
import type { GalleryStoreSeam, GalleryRecord } from '../seams/gallery-store-seam/contract';
import type { ImageGenerationSeam, GeneratedImage } from '../seams/image-generation-seam/contract';
import type { PromptCompilerSeam, PromptCompilerInput, CompiledPrompt } from '../seams/prompt-compiler-seam/contract';
import type { SafetyPolicyError, SafetyPolicySeam } from '../seams/safety-policy-seam/contract';
import type { TelemetrySeam } from '../seams/telemetry-seam/contract';

export type GenerationDependencies = {
  appConfigSeam: AppConfigSeam;
  promptCompilerSeam: PromptCompilerSeam;
  safetyPolicySeam: SafetyPolicySeam;
  imageGenerationSeam: ImageGenerationSeam;
  galleryStoreSeam: GalleryStoreSeam;
  telemetrySeam: TelemetrySeam;
};

export type GenerationWorkflowSuccess = {
  ok: true;
  data: {
    compiled: CompiledPrompt;
    images: GeneratedImage[];
    record: GalleryRecord;
  };
};

export type GenerationWorkflowFailure = {
  ok: false;
  error: {
    stage: 'user_validation' | 'compiled_validation' | 'image_generation';
    details: SafetyPolicyError | string;
  };
};

export type GenerationWorkflowResult = GenerationWorkflowSuccess | GenerationWorkflowFailure;

export type UserRequest = PromptCompilerInput;
