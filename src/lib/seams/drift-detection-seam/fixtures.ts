// Purpose: Provide fixture data for DriftDetectionSeam.
// Why: Ensure deterministic mock and test inputs.
// Info flow: fixtures -> mocks/tests.
import { z } from 'zod';
import { DriftDetectionInputSchema, DriftDetectionResultSchema } from './validators';
import { ScenarioSchema } from '../../../../contracts/shared.contract';
import sampleJson from '../../../../fixtures/drift-detection/sample.json';
import faultJson from '../../../../fixtures/drift-detection/fault.json';
import titleOnlyJson from '../../../../fixtures/drift-detection/title-only.json';

const fixtureSchema = z.object({
	scenario: ScenarioSchema,
	input: DriftDetectionInputSchema,
	output: DriftDetectionResultSchema
});

export const driftDetectionSampleFixture = fixtureSchema.parse(sampleJson);
export const driftDetectionFaultFixture = fixtureSchema.parse(faultJson);
export const driftDetectionTitleOnlyFixture = fixtureSchema.parse(titleOnlyJson);

export const getDriftDetectionFixture = (scenario: 'sample' | 'fault' = 'sample') =>
	scenario === 'fault' ? driftDetectionFaultFixture : driftDetectionSampleFixture;
