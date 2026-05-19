// Purpose: Contract tests for MeechieVoiceSeam.
// Why: Enforce mock and adapter adherence to the seam contract.
// Info flow: fixtures -> mock/adapter -> assertions.
import { describe, expect, it } from 'vitest';
import { meechieVoiceSampleFixture, meechieVoiceFaultFixture } from './fixtures';
import { createMeechieVoiceMock } from './mock';
import { meechieVoiceAdapter } from '../../adapters/meechie-voice.adapter';

describe('MeechieVoiceSeam mock contract', () => {
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
});

describe('MeechieVoiceSeam adapter contract', () => {
	it('adapter returns sample fixture output', async () => {
		const output = await meechieVoiceAdapter.getVoicePack(meechieVoiceSampleFixture.input);
		expect(output).toEqual(meechieVoiceSampleFixture.output);
	});

	it('adapter returns fault fixture output', async () => {
		const output = await meechieVoiceAdapter.getVoicePack(meechieVoiceFaultFixture.input);
		expect(output).toEqual(meechieVoiceFaultFixture.output);
	});
});
