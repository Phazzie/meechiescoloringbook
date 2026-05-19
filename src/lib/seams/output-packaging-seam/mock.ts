// Purpose: Mock OutputPackagingSeam behavior using fixtures.
// Why: Keep tests deterministic without live I/O.
// Info flow: tests -> mock -> fixtures.
import type { OutputPackagingSeam } from './contract';
import { getOutputPackagingFixture } from './fixtures';

export const createOutputPackagingMock = (scenario: 'sample' | 'fault' = 'sample'): OutputPackagingSeam => ({
	package: async () => getOutputPackagingFixture(scenario).output
});
