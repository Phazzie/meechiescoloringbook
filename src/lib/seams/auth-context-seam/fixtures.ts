/*
 * Purpose: Provide deterministic fixture data for AuthContextSeam.
 * Why: Back mock and contract testing with verified fixture shapes.
 * Info flow: Fixture JSON -> validated typed constants -> mocks/tests.
 * Invariants: Fixtures must strictly conform to AuthContextResultSchema and ScenarioSchema.
 */
import { z } from 'zod';
import { AuthContextInputSchema, AuthContextResultSchema } from './contract';
import { ScenarioSchema } from '../../../../contracts/shared.contract';
import sampleJson from '../../../../fixtures/auth-context/sample.json';
import faultJson from '../../../../fixtures/auth-context/fault.json';

const fixtureSchema = z.object({
	scenario: ScenarioSchema,
	input: AuthContextInputSchema,
	output: AuthContextResultSchema
});

export const authContextSampleFixture = fixtureSchema.parse(sampleJson);
export const authContextFaultFixture = fixtureSchema.parse(faultJson);
