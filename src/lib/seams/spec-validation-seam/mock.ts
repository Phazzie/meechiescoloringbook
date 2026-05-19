// Purpose: Mock SpecValidationSeam behavior using fixtures.
// Why: Keep tests deterministic without live I/O.
// Info flow: tests -> mock -> fixtures.
import type { SpecValidationSeam } from './contract';
import { getSpecValidationFixture } from './fixtures';

export const createSpecValidationMock = (scenario: 'sample' | 'fault' = 'sample'): SpecValidationSeam => ({
	validate: async () => getSpecValidationFixture(scenario).output
});
