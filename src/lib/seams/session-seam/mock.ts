// Purpose: Fixture-backed mock for SessionSeam.
// Why: Provide deterministic session results in contract tests.
// Info flow: Scenario -> fixture output -> callers.
import { z } from 'zod';
import { SessionResultSchema } from './contract';
import type { SessionSeam } from './contract';
import { ScenarioSchema } from '../../../../contracts/shared.contract';
import type { Scenario } from '../../../../contracts/shared.contract';
import { sessionSampleFixture, sessionFaultFixture } from './fixtures';

const fixtureSchema = z.object({
	scenario: ScenarioSchema,
	input: z.object({}).strict(),
	output: SessionResultSchema
});

const sampleFixture = fixtureSchema.parse(sessionSampleFixture);
const faultFixture = fixtureSchema.parse(sessionFaultFixture);

export const createSessionMock = (scenario: Scenario): SessionSeam => ({
	getSession: async () => (scenario === 'fault' ? faultFixture.output : sampleFixture.output)
});
