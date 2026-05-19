// Purpose: Mock MeechieToolSeam behavior using fixtures.
// Why: Keep tests deterministic without live I/O.
// Info flow: tests -> mock -> fixtures.
import type { MeechieToolSeam } from './contract';
import { getMeechieToolFixture } from './fixtures';

export const createMeechieToolMock = (scenario: 'sample' | 'fault' = 'sample'): MeechieToolSeam => ({
	respond: async () => getMeechieToolFixture(scenario).output
});
