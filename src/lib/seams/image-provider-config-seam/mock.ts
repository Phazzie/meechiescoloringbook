// Purpose: Mock ImageProviderConfigSeam behavior using fixtures.
// Why: Keep tests deterministic without live I/O.
// Info flow: tests -> mock -> fixtures.
import type { ImageProviderConfigSeam } from './contract';
import { getImageProviderConfigFixture } from './fixtures';

export const createMockImageProviderConfigSeam = (
	scenario: 'sample' | 'fault' = 'sample'
): ImageProviderConfigSeam => ({
	getConfig: () => getImageProviderConfigFixture(scenario)
});
