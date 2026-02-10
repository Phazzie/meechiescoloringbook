// Purpose: Assemble mock GenerationDependencies for deterministic runs.
// Why: Provide seam mocks without real I/O.
// Info flow: mocks -> core workflow.
import type { GenerationDependencies } from '../core/types';
import { createMockAppConfigSeam } from '../seams/app-config-seam/mock';
import { createMockGalleryStoreSeam } from '../seams/gallery-store-seam/mock';
import { createMockImageGenerationSeam } from '../seams/image-generation-seam/mock';
import { createMockPromptCompilerSeam } from '../seams/prompt-compiler-seam/mock';
import { createMockSafetyPolicySeam } from '../seams/safety-policy-seam/mock';
import { createMockTelemetrySeam } from '../seams/telemetry-seam/mock';
import type { TelemetryEvent } from '../seams/telemetry-seam/contract';

const galleryStore = createMockGalleryStoreSeam();
const telemetryStore: TelemetryEvent[] = [];

export const makeMockDependencies = (): GenerationDependencies => ({
  appConfigSeam: createMockAppConfigSeam(),
  promptCompilerSeam: createMockPromptCompilerSeam(),
  safetyPolicySeam: createMockSafetyPolicySeam(),
  imageGenerationSeam: createMockImageGenerationSeam(),
  galleryStoreSeam: galleryStore,
  telemetrySeam: createMockTelemetrySeam(telemetryStore)
});
