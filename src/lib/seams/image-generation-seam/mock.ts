// Purpose: Mock ImageGenerationSeam behavior using fixture-backed scenarios.
// Why: Keep tests deterministic and aligned with real contract outputs.
// Info flow: scenario -> fixtures -> seam result.
import type { Scenario } from '../../../../contracts/shared.contract';
import type { ImageGenerationSeam } from './contract';
import { getImageGenerationFixture } from './fixtures';

export const createMockImageGenerationSeam = (
scenario: Scenario = 'sample'
): ImageGenerationSeam => ({
generate: async () => getImageGenerationFixture(scenario).output
});
