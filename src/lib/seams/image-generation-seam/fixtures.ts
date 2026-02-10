// Purpose: Provide fixture data for ImageGenerationSeam.
// Why: Ensure deterministic mock and test inputs.
// Info flow: fixtures -> mocks/tests.
import type { ImageGenerationRequest } from './contract';

export const imageGenerationRequestFixture: ImageGenerationRequest = {
  prompt: 'a glam kitten wearing a bow',
  negativePrompt: 'color, shading, gradient',
  n: 2,
  size: '512x512',
  format: 'url'
};
