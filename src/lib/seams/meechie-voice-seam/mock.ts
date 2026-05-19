// Purpose: Mock MeechieVoiceSeam behavior using fixtures.
// Why: Keep tests deterministic without live I/O.
// Info flow: tests -> mock -> fixtures.
import type { MeechieVoiceSeam } from './contract';
import { getMeechieVoiceFixture } from './fixtures';

export const createMeechieVoiceMock = (scenario: 'sample' | 'fault' = 'sample'): MeechieVoiceSeam => ({
	getVoicePack: async () => getMeechieVoiceFixture(scenario).output
});
