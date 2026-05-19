// Purpose: Provide fixture data for OutputPackagingSeam.
// Why: Ensure deterministic mock and test inputs.
// Info flow: fixtures -> mocks/tests.
import { z } from 'zod';
import { OutputPackagingInputSchema, OutputPackagingResultSchema } from './validators';
import { ScenarioSchema } from '../../../../contracts/shared.contract';
import sampleJson from '../../../../fixtures/output-packaging/sample.json';
import faultJson from '../../../../fixtures/output-packaging/fault.json';

const fixtureSchema = z.object({
	scenario: ScenarioSchema,
	input: OutputPackagingInputSchema,
	output: OutputPackagingResultSchema
});

export const outputPackagingSampleFixture = fixtureSchema.parse(sampleJson);
export const outputPackagingFaultFixture = fixtureSchema.parse(faultJson);

export const getOutputPackagingFixture = (scenario: 'sample' | 'fault' = 'sample') =>
	scenario === 'fault' ? outputPackagingFaultFixture : outputPackagingSampleFixture;
