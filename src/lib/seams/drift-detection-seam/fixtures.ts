// Purpose: Provide fixture data for DriftDetectionSeam.
// Why: Ensure deterministic mock and test inputs.
// Info flow: fixtures -> mocks/tests.
import { z } from 'zod';
import { DriftDetectionInputSchema, DriftDetectionResultSchema } from './contract';
import { ScenarioSchema } from '../../../../contracts/shared.contract';
import sampleJson from './sample.json';
import faultJson from './fault.json';
import titleOnlyJson from './title-only.json';

const fixtureSchema = z.object({
	scenario: ScenarioSchema,
	input: DriftDetectionInputSchema,
	output: DriftDetectionResultSchema
});

export const driftDetectionSampleFixture = fixtureSchema.parse(sampleJson);
export const driftDetectionFaultFixture = fixtureSchema.parse(faultJson);
export const driftDetectionTitleOnlyFixture = fixtureSchema.parse(titleOnlyJson);
