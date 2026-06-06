// Purpose: Contract tests for MeechieVoiceSeam using fixture-backed mocks.
// Why: Keep Meechie voice packs deterministic and editable.
// Info flow: Fixtures -> mock/adapter -> assertions.
import { describe, expect, it } from 'vitest';
import { meechieVoiceSampleFixture, meechieVoiceFaultFixture } from './fixtures';
import { createMeechieVoiceMock } from './mock';
import { meechieVoiceAdapter } from '../../adapters/meechie-voice-seam';

describe('MeechieVoiceSeam contract', () => {
	it('mock returns sample fixture output', async () => {
		const mock = createMeechieVoiceMock('sample');
		const output = await mock.getVoicePack(meechieVoiceSampleFixture.input);
		expect(output).toEqual(meechieVoiceSampleFixture.output);
	});

	it('mock returns fault fixture output', async () => {
		const mock = createMeechieVoiceMock('fault');
		const output = await mock.getVoicePack(meechieVoiceFaultFixture.input);
		expect(output).toEqual(meechieVoiceFaultFixture.output);
	});

	it('adapter returns sample fixture output', async () => {
		const output = await meechieVoiceAdapter.getVoicePack(meechieVoiceSampleFixture.input);
		expect(output).toEqual(meechieVoiceSampleFixture.output);
	});

	it('adapter returns fault fixture output', async () => {
		const output = await meechieVoiceAdapter.getVoicePack(meechieVoiceFaultFixture.input);
		expect(output).toEqual(meechieVoiceFaultFixture.output);
	});
});
