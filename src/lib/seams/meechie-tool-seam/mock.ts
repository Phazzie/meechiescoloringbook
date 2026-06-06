// Purpose: Mock MeechieToolSeam behavior using fixtures.
// Why: Keep Meechie responses deterministic in contract tests.
// Info flow: Scenario -> fixture output -> callers.
import type { MeechieToolSeam } from './contract';
import { meechieToolSampleFixture, meechieToolFaultFixture } from './fixtures';

export const createMeechieToolMock = (scenario: 'sample' | 'fault' = 'sample'): MeechieToolSeam => ({
	respond: async () =>
		scenario === 'fault' ? meechieToolFaultFixture.output : meechieToolSampleFixture.output
});
