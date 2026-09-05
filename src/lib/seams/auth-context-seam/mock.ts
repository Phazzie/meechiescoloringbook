/*
 * Purpose: Provide fixture-backed mock implementation of AuthContextSeam.
 * Why: Ensure deterministic auth context resolution during tests and verification.
 * Info flow: Scenario parameter -> selected fixture -> callers.
 * Invariants: Fault scenario returns SESSION_ID_INVALID; sample returns anonymous auth context.
 */
import type { AuthContextSeam, AuthContextInput } from './contract';
import type { Scenario } from '../../../../contracts/shared.contract';
import { authContextSampleFixture, authContextFaultFixture } from './fixtures';

export const createAuthContextMock = (scenario: Scenario = 'sample'): AuthContextSeam => ({
	getAuthContext: async (_input?: AuthContextInput) =>
		scenario === 'fault' ? authContextFaultFixture.output : authContextSampleFixture.output
});
