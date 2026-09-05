/*
 * Purpose: Provide fixture-backed mock implementation of ChatInterpretationSeam.
 * Why: Ensure deterministic chat interpretation during tests and verification.
 * Info flow: Scenario parameter -> selected fixture -> callers.
 * Invariants: Fault scenario returns CHAT_RESPONSE_INVALID error; sample returns valid coloring page spec.
 */
import type { ChatInterpretationSeam } from './contract';
import type { Scenario } from '../../../../contracts/shared.contract';
import { chatInterpretationSampleFixture, chatInterpretationFaultFixture } from './fixtures';

export const createChatInterpretationMock = (scenario: Scenario = 'sample'): ChatInterpretationSeam => ({
	interpret: async () =>
		scenario === 'fault' ? chatInterpretationFaultFixture.output : chatInterpretationSampleFixture.output
});
