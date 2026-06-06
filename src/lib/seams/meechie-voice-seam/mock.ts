// Purpose: Mock MeechieVoiceSeam behavior using fixtures.
// Why: Keep Meechie voice packs deterministic in contract tests.
// Info flow: Scenario -> fixture output -> callers.
import type { MeechieVoiceSeam } from './contract';
import { meechieVoiceSampleFixture, meechieVoiceFaultFixture } from './fixtures';

export const createMeechieVoiceMock = (scenario: 'sample' | 'fault' = 'sample'): MeechieVoiceSeam => ({
	getVoicePack: async () =>
		scenario === 'fault' ? meechieVoiceFaultFixture.output : meechieVoiceSampleFixture.output
});
