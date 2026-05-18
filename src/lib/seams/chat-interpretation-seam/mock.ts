// Purpose: Fixture-backed mock for ChatInterpretationSeam.
// Why: Provide deterministic intent mapping outputs in tests.
// Info flow: Scenario -> fixture output -> callers.
import { z } from 'zod';
import {
	ChatInterpretationInputSchema,
	ChatInterpretationResultSchema
} from './contract';
import type { ChatInterpretationSeam } from './contract';
import { ScenarioSchema } from '../../../../contracts/shared.contract';
import type { Scenario } from '../../../../contracts/shared.contract';
import { chatInterpretationSampleFixture, chatInterpretationFaultFixture } from './fixtures';

const fixtureSchema = z.object({
	scenario: ScenarioSchema,
	input: ChatInterpretationInputSchema,
	output: ChatInterpretationResultSchema
});

const sampleFixture = fixtureSchema.parse(chatInterpretationSampleFixture);
const faultFixture = fixtureSchema.parse(chatInterpretationFaultFixture);

export const createChatInterpretationMock = (scenario: Scenario): ChatInterpretationSeam => ({
	interpret: async () => (scenario === 'fault' ? faultFixture.output : sampleFixture.output)
});
