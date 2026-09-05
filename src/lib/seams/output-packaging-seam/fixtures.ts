/*
 * Purpose: Provide deterministic fixture data for OutputPackagingSeam.
 * Why: Back mock and contract testing with verified packaging output shapes.
 * Info flow: Fixture JSON -> validated typed constants -> mocks/tests.
 * Invariants: Fixtures must strictly conform to OutputPackagingInputSchema, OutputPackagingResultSchema, and ScenarioSchema.
 */
import { z } from 'zod';
import {
	OutputPackagingInputSchema,
	OutputPackagingResultSchema
} from './contract';
import { ScenarioSchema } from '../../../../contracts/shared.contract';
import sampleJson from '../../../../fixtures/output-packaging/sample.json';
import faultJson from '../../../../fixtures/output-packaging/fault.json';

const fixtureSchema = z.object({
	scenario: ScenarioSchema,
	input: OutputPackagingInputSchema,
	output: OutputPackagingResultSchema
});

export const outputPackagingSampleFixture = fixtureSchema.parse(sampleJson);
export const outputPackagingFaultFixture = fixtureSchema.parse(faultJson);
