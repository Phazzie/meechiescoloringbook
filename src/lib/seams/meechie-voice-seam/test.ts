// Purpose: Contract tests for MeechieVoiceSeam using fixture-backed mocks.
// Why: Keep Meechie voice packs deterministic and editable.
// Info flow: Fixtures -> mock/adapter -> assertions.
import { describe, expect, it } from 'vitest';
import { meechieVoiceSampleFixture, meechieVoiceFaultFixture } from './fixtures';
import { createMeechieVoiceMock, createMalformedVoicePackMock } from './mock';
import { meechieVoiceAdapter } from '../../adapters/meechie-voice-seam';
import { MeechieVoicePackSchema, MeechieVoiceResultSchema } from './contract';
import { meechieVoiceMalformedPackFixture } from './fixtures';
import { MeechieQuoteSchema } from '../../../../contracts/meechie-quote.contract';
import { meechieVoicePack } from './voice-pack';

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

// Red proof for the quote schema. The fault fixture only exercises an unknown
// voiceId, so on its own it cannot show that a malformed voice pack is rejected.
// These cases feed faulty packs straight at the schema and require a failure.
describe('MeechieQuoteSchema rejects faulty quotes', () => {
	const valid = { tier: 'canon', id: 'edges', text: 'A line.' };

	it('accepts a well-formed quote', () => {
		expect(MeechieQuoteSchema.safeParse(valid).success).toBe(true);
	});

	it.each([
		['missing tier', { id: 'edges', text: 'A line.' }],
		['unknown tier', { ...valid, tier: 'raw_anchor' }],
		['missing id', { tier: 'canon', text: 'A line.' }],
		['empty id', { ...valid, id: '' }],
		['missing text', { tier: 'canon', id: 'edges' }],
		['empty text', { ...valid, text: '' }],
		['extra field', { ...valid, coloringPageReady: true }]
	])('rejects a quote with %s', (_label, quote) => {
		expect(MeechieQuoteSchema.safeParse(quote).success).toBe(false);
	});

	it('rejects the retired pre-migration quote shape', () => {
		const retired = {
			text: 'A line.',
			category: 'raw_anchor',
			rawness: 'raw',
			thirdPersonUsage: 'none',
			modeFit: ['random_meechie'],
			defaultMode: true,
			coloringPageReady: false,
			notes: 'Meechie canon line',
			visualMotifs: ['glam']
		};
		expect(MeechieQuoteSchema.safeParse(retired).success).toBe(false);
	});

	it('accepts the real voice pack', () => {
		expect(MeechieVoicePackSchema.safeParse(meechieVoicePack).success).toBe(true);
	});
});

// The fixture-backed half of the red proof. src/lib/seams/AGENTS.md section 3
// asks for the contract test to fail when the MOCK is run against a FAULT
// FIXTURE, so asserting on inline objects is not enough on its own:
// fixtures/meechie-voice/malformed-pack.json is a checked-in pack whose quotes
// still carry the retired pre-migration shape, and createMalformedVoicePackMock
// serves it the same way createMeechieVoiceMock serves the good one.
describe('MeechieVoiceSeam rejects the malformed-pack fault fixture', () => {
	it('rejects the fixture file itself', () => {
		const parsed = MeechieVoiceResultSchema.safeParse(
			(meechieVoiceMalformedPackFixture as { output: unknown }).output
		);
		expect(parsed.success).toBe(false);
	});

	it('rejects what the mock returns when run against that fixture', async () => {
		const mock = createMalformedVoicePackMock();
		const output = await mock.getVoicePack({ voiceId: 'meechie' });
		const parsed = MeechieVoiceResultSchema.safeParse(output);
		expect(parsed.success).toBe(false);
	});

	it('points at the offending quotes, not somewhere else in the pack', async () => {
		const mock = createMalformedVoicePackMock();
		const output = await mock.getVoicePack({ voiceId: 'meechie' });
		const parsed = MeechieVoiceResultSchema.safeParse(output);
		if (parsed.success) throw new Error('malformed fixture unexpectedly parsed');
		const paths = parsed.error.issues.map((issue) => issue.path.join('.'));
		expect(paths.every((path) => path.includes('responses.quotes'))).toBe(true);
		// One issue per bad quote: retired shape, missing id, unknown tier.
		expect(new Set(paths).size).toBeGreaterThanOrEqual(3);
	});

	it('still accepts the good sample fixture through the normal mock', async () => {
		const mock = createMeechieVoiceMock('sample');
		const output = await mock.getVoicePack({ voiceId: 'meechie' });
		expect(MeechieVoiceResultSchema.safeParse(output).success).toBe(true);
	});
});
