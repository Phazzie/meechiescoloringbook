// Purpose: Mock DriftDetectionSeam behavior using fixtures.
// Why: Provide deterministic drift detection outputs for tests.
// Info flow: Scenario -> fixture output -> callers.
import type { DriftDetectionSeam } from './contract';
import { driftDetectionSampleFixture, driftDetectionFaultFixture } from './fixtures';

export const createDriftDetectionMock = (scenario: 'sample' | 'fault' = 'sample'): DriftDetectionSeam => ({
	detect: async () =>
		scenario === 'fault' ? driftDetectionFaultFixture.output : driftDetectionSampleFixture.output
});
