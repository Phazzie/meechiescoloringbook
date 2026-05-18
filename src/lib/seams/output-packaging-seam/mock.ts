// Purpose: Fixture-backed mock for OutputPackagingSeam.
// Why: Ensure packaging outputs are deterministic in contract tests.
// Info flow: Scenario -> fixture output -> callers.
import { z } from 'zod';
import {
	OutputPackagingInputSchema,
	OutputPackagingResultSchema
} from './contract';
import type { OutputPackagingSeam } from './contract';
import { ScenarioSchema } from '../../../../contracts/shared.contract';
import type { Scenario } from '../../../../contracts/shared.contract';
import { outputPackagingSampleFixture, outputPackagingFaultFixture } from './fixtures';

const fixtureSchema = z.object({
	scenario: ScenarioSchema,
	input: OutputPackagingInputSchema,
	output: OutputPackagingResultSchema
});

const sampleFixture = fixtureSchema.parse(outputPackagingSampleFixture);
const faultFixture = fixtureSchema.parse(outputPackagingFaultFixture);

export const createOutputPackagingMock = (scenario: Scenario): OutputPackagingSeam => ({
	package: async () => (scenario === 'fault' ? faultFixture.output : sampleFixture.output)
});
