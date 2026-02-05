// Purpose: Fixture-backed mock for SessionSeam.
// Why: Provide deterministic session results in contract tests.
// Info flow: Scenario -> fixture output -> callers.
import { z } from 'zod';
import { SessionResultSchema } from '../../../contracts/session.contract';
import type { SessionSeam } from '../../../contracts/session.contract';
import { ScenarioSchema } from '../../../contracts/shared.contract';
import type { Scenario } from '../../../contracts/shared.contract';
import sample from '../../../fixtures/session/sample.json';
import fault from '../../../fixtures/session/fault.json';

const fixtureSchema = z.object({
	scenario: ScenarioSchema,
	input: z.object({}).strict(),
	output: SessionResultSchema
});

const sampleFixture = fixtureSchema.parse(sample);
const faultFixture = fixtureSchema.parse(fault);

export const createSessionMock = (scenario: Scenario): SessionSeam => ({
	getSession: async () => (scenario === 'fault' ? faultFixture.output : sampleFixture.output)
});
