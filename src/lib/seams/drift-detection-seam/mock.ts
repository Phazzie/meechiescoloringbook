// Purpose: Fixture-backed mock for DriftDetectionSeam.
// Why: Provide deterministic drift detection outputs for tests.
// Info flow: Scenario -> fixture output -> callers.
import { z } from 'zod';
import {
	DriftDetectionInputSchema,
	DriftDetectionResultSchema
} from './contract';
import type { DriftDetectionSeam } from './contract';
import { ScenarioSchema } from '../../../../contracts/shared.contract';
import type { Scenario } from '../../../../contracts/shared.contract';
import { driftDetectionSampleFixture, driftDetectionFaultFixture } from './fixtures';

const fixtureSchema = z.object({
	scenario: ScenarioSchema,
	input: DriftDetectionInputSchema,
	output: DriftDetectionResultSchema
});

const sampleFixture = fixtureSchema.parse(driftDetectionSampleFixture);
const faultFixture = fixtureSchema.parse(driftDetectionFaultFixture);

export const createDriftDetectionMock = (scenario: Scenario): DriftDetectionSeam => ({
	detect: async () => (scenario === 'fault' ? faultFixture.output : sampleFixture.output)
});
