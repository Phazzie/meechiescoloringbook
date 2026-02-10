// Purpose: Compose server dependencies with live seams when configured.
// Why: Switch between mock and live seams based on environment.
// Info flow: env -> dependency selection -> workflow.
import type { GenerationDependencies } from '../core/types';
import { createAppConfigSeam } from '../adapters/app-config-seam';
import { createImageGenerationSeam } from '../adapters/image-generation-seam';
import { makeMockDependencies } from './deps.mock';

export const makeServerDependencies = (): GenerationDependencies => {
  if (!process.env.XAI_API_KEY) {
    return makeMockDependencies();
  }

  const appConfigSeam = createAppConfigSeam();
  return {
    ...makeMockDependencies(),
    appConfigSeam,
    imageGenerationSeam: createImageGenerationSeam(appConfigSeam)
  };
};
