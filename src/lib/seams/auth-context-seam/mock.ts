// Purpose: Fixture-backed mock for AuthContextSeam.
// Why: Keep auth context responses deterministic for tests.
// Info flow: Scenario -> fixture output -> callers.
import { z } from 'zod';
import {
	AuthContextInputSchema,
	AuthContextResultSchema
} from './contract';
import type { AuthContextSeam } from './contract';
import { ScenarioSchema } from '../../../../contracts/shared.contract';
import type { Scenario } from '../../../../contracts/shared.contract';
import { authContextSampleFixture, authContextFaultFixture } from './fixtures';

const fixtureSchema = z.object({
	scenario: ScenarioSchema,
	input: AuthContextInputSchema,
	output: AuthContextResultSchema
});

const sampleFixture = fixtureSchema.parse(authContextSampleFixture);
const faultFixture = fixtureSchema.parse(authContextFaultFixture);

export const createAuthContextMock = (scenario: Scenario): AuthContextSeam => ({
	getAuthContext: async () => (scenario === 'fault' ? faultFixture.output : sampleFixture.output)
});
