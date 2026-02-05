// Purpose: Fixture-backed mock for DriftDetectionSeam.
// Why: Provide deterministic drift detection outputs for tests.
// Info flow: Scenario -> fixture output -> callers.
import { z } from 'zod';
import {
	DriftDetectionInputSchema,
	DriftDetectionResultSchema
} from '../../../contracts/drift-detection.contract';
import type { DriftDetectionSeam } from '../../../contracts/drift-detection.contract';
import { ScenarioSchema } from '../../../contracts/shared.contract';
import type { Scenario } from '../../../contracts/shared.contract';
import sample from '../../../fixtures/drift-detection/sample.json';
import fault from '../../../fixtures/drift-detection/fault.json';

const fixtureSchema = z.object({
	scenario: ScenarioSchema,
	input: DriftDetectionInputSchema,
	output: DriftDetectionResultSchema
});

const sampleFixture = fixtureSchema.parse(sample);
const faultFixture = fixtureSchema.parse(fault);

export const createDriftDetectionMock = (scenario: Scenario): DriftDetectionSeam => ({
	detect: async () => (scenario === 'fault' ? faultFixture.output : sampleFixture.output)
});
