// Purpose: Mock DriftDetectionSeam behavior using fixtures.
// Why: Keep tests deterministic without live I/O.
// Info flow: tests -> mock -> fixtures.
import type { DriftDetectionSeam } from './contract';
import { getDriftDetectionFixture } from './fixtures';

export const createDriftDetectionMock = (scenario: 'sample' | 'fault' = 'sample'): DriftDetectionSeam => ({
	detect: async () => getDriftDetectionFixture(scenario).output
});
