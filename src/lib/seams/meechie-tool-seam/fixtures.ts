// Purpose: Provide fixture data for MeechieToolSeam.
// Why: Ensure deterministic mock and test inputs.
// Info flow: fixtures -> mocks/tests.
import { z } from 'zod';
import { MeechieToolInputSchema, MeechieToolResultSchema } from './contract';
import { ScenarioSchema } from '../../../../contracts/shared.contract';
import sampleJson from '../../../../fixtures/meechie-tool/sample.json';
import faultJson from '../../../../fixtures/meechie-tool/fault.json';

const fixtureSchema = z.object({
	scenario: ScenarioSchema,
	input: MeechieToolInputSchema,
	output: MeechieToolResultSchema
});

export const meechieToolSampleFixture = fixtureSchema.parse(sampleJson);
export const meechieToolFaultFixture = fixtureSchema.parse(faultJson);
