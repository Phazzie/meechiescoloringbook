// Purpose: Fixture-backed mock for ChatInterpretationSeam.
// Why: Provide deterministic intent mapping outputs in tests.
// Info flow: Scenario -> fixture output -> callers.
import { z } from 'zod';
import {
	ChatInterpretationInputSchema,
	ChatInterpretationResultSchema
} from '../../../contracts/chat-interpretation.contract';
import type { ChatInterpretationSeam } from '../../../contracts/chat-interpretation.contract';
import { ScenarioSchema } from '../../../contracts/shared.contract';
import type { Scenario } from '../../../contracts/shared.contract';
import sample from '../../../fixtures/chat-interpretation/sample.json';
import fault from '../../../fixtures/chat-interpretation/fault.json';

const fixtureSchema = z.object({
	scenario: ScenarioSchema,
	input: ChatInterpretationInputSchema,
	output: ChatInterpretationResultSchema
});

const sampleFixture = fixtureSchema.parse(sample);
const faultFixture = fixtureSchema.parse(fault);

export const createChatInterpretationMock = (scenario: Scenario): ChatInterpretationSeam => ({
	interpret: async () => (scenario === 'fault' ? faultFixture.output : sampleFixture.output)
});
