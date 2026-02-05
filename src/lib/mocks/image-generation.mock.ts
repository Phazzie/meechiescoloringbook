// Purpose: Fixture-backed mock for ImageGenerationSeam.
// Why: Keep image generation deterministic during contract tests.
// Info flow: Scenario -> fixture output -> callers.
import { z } from 'zod';
import {
	ImageGenerationInputSchema,
	ImageGenerationResultSchema
} from '../../../contracts/image-generation.contract';
import type { ImageGenerationSeam } from '../../../contracts/image-generation.contract';
import { ScenarioSchema } from '../../../contracts/shared.contract';
import type { Scenario } from '../../../contracts/shared.contract';
import sample from '../../../fixtures/image-generation/sample.json';
import fault from '../../../fixtures/image-generation/fault.json';

const fixtureSchema = z.object({
	scenario: ScenarioSchema,
	input: ImageGenerationInputSchema,
	output: ImageGenerationResultSchema
});

const sampleFixture = fixtureSchema.parse(sample);
const faultFixture = fixtureSchema.parse(fault);

export const createImageGenerationMock = (scenario: Scenario): ImageGenerationSeam => ({
	generate: async () => (scenario === 'fault' ? faultFixture.output : sampleFixture.output)
});
