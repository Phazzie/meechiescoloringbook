// Purpose: Mock MeechieVoiceSeam behavior using fixtures.
// Why: Keep Meechie voice packs deterministic in contract tests.
// Info flow: Scenario -> fixture output -> callers.
import type { MeechieVoiceResult, MeechieVoiceSeam } from './contract';
import {
	meechieVoiceSampleFixture,
	meechieVoiceFaultFixture,
	meechieVoiceMalformedPackFixture
} from './fixtures';

export const createMeechieVoiceMock = (scenario: 'sample' | 'fault' = 'sample'): MeechieVoiceSeam => ({
	getVoicePack: async () =>
		scenario === 'fault' ? meechieVoiceFaultFixture.output : meechieVoiceSampleFixture.output
});

// Red-proof double. Serves the malformed-pack fixture so a contract test can run
// the mock and watch MeechieVoiceResultSchema reject what comes back. The cast is
// deliberate: the whole point is to emit output that violates the contract, which
// a correctly-typed mock cannot express.
export const createMalformedVoicePackMock = (): MeechieVoiceSeam => ({
	getVoicePack: async () =>
		(meechieVoiceMalformedPackFixture as { output: MeechieVoiceResult }).output
});
