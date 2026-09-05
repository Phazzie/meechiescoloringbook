/*
 * Purpose: Provide deterministic fixture data for ChatInterpretationSeam.
 * Why: Back mock and contract testing with verified intent interpretation outputs.
 * Info flow: Fixture JSON -> validated typed constants -> mocks/tests.
 * Invariants: Fixtures must strictly conform to ChatInterpretationInputSchema, ChatInterpretationResultSchema, and ScenarioSchema.
 */
import { z } from 'zod';
import {
	ChatInterpretationInputSchema,
	ChatInterpretationResultSchema
} from './contract';
import { ScenarioSchema } from '../../../../contracts/shared.contract';
import sampleJson from '../../../../fixtures/chat-interpretation/sample.json';
import faultJson from '../../../../fixtures/chat-interpretation/fault.json';

const fixtureSchema = z.object({
	scenario: ScenarioSchema,
	input: ChatInterpretationInputSchema,
	output: ChatInterpretationResultSchema
});

export const chatInterpretationSampleFixture = fixtureSchema.parse(sampleJson);
export const chatInterpretationFaultFixture = fixtureSchema.parse(faultJson);
