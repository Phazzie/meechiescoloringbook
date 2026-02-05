// Purpose: Fixture-backed mock for AuthContextSeam.
// Why: Keep auth context responses deterministic for tests.
// Info flow: Scenario -> fixture output -> callers.
import { z } from 'zod';
import {
	AuthContextInputSchema,
	AuthContextResultSchema
} from '../../../contracts/auth-context.contract';
import type { AuthContextSeam } from '../../../contracts/auth-context.contract';
import { ScenarioSchema } from '../../../contracts/shared.contract';
import type { Scenario } from '../../../contracts/shared.contract';
import sample from '../../../fixtures/auth-context/sample.json';
import fault from '../../../fixtures/auth-context/fault.json';

const fixtureSchema = z.object({
	scenario: ScenarioSchema,
	input: AuthContextInputSchema,
	output: AuthContextResultSchema
});

const sampleFixture = fixtureSchema.parse(sample);
const faultFixture = fixtureSchema.parse(fault);

export const createAuthContextMock = (scenario: Scenario): AuthContextSeam => ({
	getAuthContext: async () => (scenario === 'fault' ? faultFixture.output : sampleFixture.output)
});
