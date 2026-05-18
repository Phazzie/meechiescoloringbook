// Purpose: Contract tests for MeechieVoiceSeam using fixture-backed mocks.
// Why: Keep Meechie voice packs deterministic and editable.
// Info flow: Fixtures -> mock/adapter -> assertions.
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import {
	MeechieVoiceInputSchema,
	MeechieVoiceResultSchema
} from './contract';
import { ScenarioSchema } from '../../../../contracts/shared.contract';
import { createMeechieVoiceMock } from './mock';
import { meechieVoiceAdapter } from '../../adapters/meechie-voice-seam';
import { meechieVoiceSampleFixture, meechieVoiceFaultFixture } from './fixtures';

const fixtureSchema = z.object({
	scenario: ScenarioSchema,
	input: MeechieVoiceInputSchema,
	output: MeechieVoiceResultSchema
});

const sampleFixture = fixtureSchema.parse(meechieVoiceSampleFixture);
const faultFixture = fixtureSchema.parse(meechieVoiceFaultFixture);

describe('MeechieVoiceSeam contract', () => {
	it('mock returns sample fixture output', async () => {
		const mock = createMeechieVoiceMock('sample');
		const output = await mock.getVoicePack(sampleFixture.input);
		expect(output).toEqual(sampleFixture.output);
	});

	it('mock returns fault fixture output', async () => {
		const mock = createMeechieVoiceMock('fault');
		const output = await mock.getVoicePack(faultFixture.input);
		expect(output).toEqual(faultFixture.output);
	});

	it('adapter returns sample fixture output', async () => {
		const output = await meechieVoiceAdapter.getVoicePack(sampleFixture.input);
		expect(output).toEqual(sampleFixture.output);
	});

	it('adapter returns fault fixture output', async () => {
		const output = await meechieVoiceAdapter.getVoicePack(faultFixture.input);
		expect(output).toEqual(faultFixture.output);
	});
});
