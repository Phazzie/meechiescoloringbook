// Purpose: Unit tests for generation workflow orchestration.
// Why: Ensure success and failure paths are handled deterministically.
// Info flow: tests -> workflow -> seam mocks -> assertions.
import { describe, expect, it } from 'vitest';
import { runGenerationWorkflow } from '../../src/lib/core/generation-workflow';
import type { GenerationDependencies } from '../../src/lib/core/types';
import { createMockAppConfigSeam } from '../../src/lib/seams/app-config-seam/mock';
import { createMockGalleryStoreSeam } from '../../src/lib/seams/gallery-store-seam/mock';
import { createMockImageGenerationSeam } from '../../src/lib/seams/image-generation-seam/mock';
import { createMockPromptCompilerSeam } from '../../src/lib/seams/prompt-compiler-seam/mock';
import { promptCompilerInputFixture } from '../../src/lib/seams/prompt-compiler-seam/fixtures';
import { createMockSafetyPolicySeam } from '../../src/lib/seams/safety-policy-seam/mock';
import { unsafeUserRequestFixture } from '../../src/lib/seams/safety-policy-seam/fixtures';
import { createMockTelemetrySeam } from '../../src/lib/seams/telemetry-seam/mock';
import type { TelemetryEvent } from '../../src/lib/seams/telemetry-seam/contract';

const createMockDeps = (): { deps: GenerationDependencies; telemetryStore: TelemetryEvent[] } => {
  const telemetryEvents: TelemetryEvent[] = [];
  const deps: GenerationDependencies = {
    appConfigSeam: createMockAppConfigSeam(),
    promptCompilerSeam: createMockPromptCompilerSeam(),
    safetyPolicySeam: createMockSafetyPolicySeam(),
    imageGenerationSeam: createMockImageGenerationSeam(),
    galleryStoreSeam: createMockGalleryStoreSeam(),
    telemetrySeam: createMockTelemetrySeam(telemetryEvents)
  };

  return { deps, telemetryStore: telemetryEvents };
};

describe('generation workflow', () => {
  it('generates images and stores history', async () => {
    const { deps } = createMockDeps();

    const result = await runGenerationWorkflow(promptCompilerInputFixture, deps);
    expect(result.ok).toBe(true);

    const history = await deps.galleryStoreSeam.listRecent(1);
    expect(history).toHaveLength(1);
    expect(history[0]?.images).toHaveLength(1);
  });

  it('rejects unsafe user input', async () => {
    const { deps } = createMockDeps();

    const result = await runGenerationWorkflow(unsafeUserRequestFixture, deps);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.stage).toBe('user_validation');
    }

    const history = await deps.galleryStoreSeam.listRecent(1);
    expect(history).toHaveLength(0);
  });
});
