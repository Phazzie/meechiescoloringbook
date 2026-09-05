/*
 * Purpose: Provide deterministic fixture data for MeechieStudioTextSeam.
 * Why: Back mock and contract testing with verified studio text responses.
 * Info flow: Fixture JSON -> validated typed constants -> mocks/tests.
 * Invariants: Fixtures must strictly conform to MeechieStudioTextInputSchema, MeechieStudioTextResultSchema, and ScenarioSchema.
 */
import { z } from 'zod';
import {
	MeechieStudioTextInputSchema,
	MeechieStudioTextResultSchema
} from './contract';
import { ScenarioSchema } from '../../../../contracts/shared.contract';
import sampleJson from '../../../../fixtures/meechie-studio-text/sample.json';
import faultJson from '../../../../fixtures/meechie-studio-text/fault.json';

const fixtureSchema = z.object({
	scenario: ScenarioSchema,
	input: MeechieStudioTextInputSchema,
	output: MeechieStudioTextResultSchema
});

export const meechieStudioTextSampleFixture = fixtureSchema.parse(sampleJson);
export const meechieStudioTextFaultFixture = fixtureSchema.parse(faultJson);
