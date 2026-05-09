// Purpose: Provide fixture data for ImageGenerationSeam.
// Why: Ensure deterministic sample/fault scenarios for mock and tests.
// Info flow: fixture JSON -> parsed fixtures -> seam mock/tests.
import { z } from 'zod';
import type { Scenario } from '../../../../contracts/shared.contract';
import { ScenarioSchema } from '../../../../contracts/shared.contract';
import sample from '../../../../fixtures/image-generation/sample.json';
import fault from '../../../../fixtures/image-generation/fault.json';
import {
imageGenerationRequestSchema,
imageGenerationResultSchema,
type ImageGenerationRequest
} from './contract';

const imageGenerationFixtureSchema = z.object({
scenario: ScenarioSchema,
input: imageGenerationRequestSchema,
output: imageGenerationResultSchema
});

export type ImageGenerationFixture = z.infer<typeof imageGenerationFixtureSchema>;

export const imageGenerationSampleFixture = imageGenerationFixtureSchema.parse(sample);
export const imageGenerationFaultFixture = imageGenerationFixtureSchema.parse(fault);

export const imageGenerationRequestFixture: ImageGenerationRequest = imageGenerationSampleFixture.input;

export const getImageGenerationFixture = (
scenario: Scenario = 'sample'
): ImageGenerationFixture =>
scenario === 'fault' ? imageGenerationFaultFixture : imageGenerationSampleFixture;
