// Purpose: Fixture-backed mock for OutputPackagingSeam.
// Why: Ensure packaging outputs are deterministic in contract tests.
// Info flow: Scenario -> fixture output -> callers.
import { z } from 'zod';
import {
	OutputPackagingInputSchema,
	OutputPackagingResultSchema
} from '../../../contracts/output-packaging.contract';
import type { OutputPackagingSeam } from '../../../contracts/output-packaging.contract';
import { ScenarioSchema } from '../../../contracts/shared.contract';
import type { Scenario } from '../../../contracts/shared.contract';
import sample from '../../../fixtures/output-packaging/sample.json';
import fault from '../../../fixtures/output-packaging/fault.json';

const fixtureSchema = z.object({
	scenario: ScenarioSchema,
	input: OutputPackagingInputSchema,
	output: OutputPackagingResultSchema
});

const sampleFixture = fixtureSchema.parse(sample);
const faultFixture = fixtureSchema.parse(fault);

export const createOutputPackagingMock = (scenario: Scenario): OutputPackagingSeam => ({
	package: async () => (scenario === 'fault' ? faultFixture.output : sampleFixture.output)
});
