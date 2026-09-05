/*
 * Purpose: Provide fixture-backed mock implementation of SessionSeam.
 * Why: Ensure deterministic session context resolution during tests and verification.
 * Info flow: Scenario parameter -> selected fixture -> callers.
 * Invariants: Fault scenario must return BROWSER_REQUIRED; sample must return valid sessionId.
 */
import type { SessionSeam } from './contract';
import type { Scenario } from '../../../../contracts/shared.contract';
import { sessionSampleFixture, sessionFaultFixture } from './fixtures';

export const createSessionMock = (scenario: Scenario = 'sample'): SessionSeam => ({
	getSession: async () => (scenario === 'fault' ? sessionFaultFixture.output : sessionSampleFixture.output)
});
