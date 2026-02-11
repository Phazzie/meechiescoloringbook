// Purpose: Mock AppConfigSeam behavior using fixtures.
// Why: Keep tests deterministic without live I/O.
// Info flow: tests -> mock -> fixtures.
import type { AppConfigSeam } from './contract';
import { getAppConfigFixture } from './fixtures';

export const createMockAppConfigSeam = (scenario: 'sample' | 'fault' = 'sample'): AppConfigSeam => ({
  getConfig: () => getAppConfigFixture(scenario)
});
