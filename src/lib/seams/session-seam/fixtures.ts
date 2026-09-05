/*
 * Purpose: Provide deterministic fixture data for SessionSeam.
 * Why: Back mock and contract testing with verified fixture shapes.
 * Info flow: Fixture JSON -> validated typed constants -> mocks/tests.
 * Invariants: Fixtures must strictly conform to SessionResultSchema and ScenarioSchema.
 */
import { z } from 'zod';
import { SessionResultSchema } from './contract';
import { ScenarioSchema } from '../../../../contracts/shared.contract';
import sampleJson from '../../../../fixtures/session/sample.json';
import faultJson from '../../../../fixtures/session/fault.json';

const fixtureSchema = z.object({
	scenario: ScenarioSchema,
	input: z.object({}).strict(),
	output: SessionResultSchema
});

export const sessionSampleFixture = fixtureSchema.parse(sampleJson);
export const sessionFaultFixture = fixtureSchema.parse(faultJson);
