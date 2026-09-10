// Purpose: Contract tests for DriftDetectionSeam using fixture-backed mocks.
// Why: Ensure drift rules are deterministic and auditable.
// Info flow: Fixtures -> mock/adapter -> assertions.
import { describe, expect, it } from 'vitest';
import {
	driftDetectionSampleFixture,
	driftDetectionFaultFixture,
	driftDetectionTitleOnlyFixture
} from './fixtures';
import { createDriftDetectionMock } from './mock';
import { driftDetectionAdapter } from '../../adapters/drift-detection-seam';

describe('DriftDetectionSeam contract', () => {
	it('mock returns sample fixture output', async () => {
		const mock = createDriftDetectionMock('sample');
		const output = await mock.detect(driftDetectionSampleFixture.input);
		expect(output).toEqual(driftDetectionSampleFixture.output);
	});

	it('mock returns fault fixture output', async () => {
		const mock = createDriftDetectionMock('fault');
		const output = await mock.detect(driftDetectionFaultFixture.input);
		expect(output).toEqual(driftDetectionFaultFixture.output);
	});

	it('adapter returns sample fixture output', async () => {
		const output = await driftDetectionAdapter.detect(driftDetectionSampleFixture.input);
		expect(output).toEqual(driftDetectionSampleFixture.output);
	});

	it('adapter returns fault fixture output', async () => {
		const output = await driftDetectionAdapter.detect(driftDetectionFaultFixture.input);
		expect(output).toEqual(driftDetectionFaultFixture.output);
	});

	it('adapter returns title-only fixture output', async () => {
		const output = await driftDetectionAdapter.detect(driftDetectionTitleOnlyFixture.input);
		expect(output).toEqual(driftDetectionTitleOnlyFixture.output);
	});

	// `textSize` and `whitespaceScale` are required `ColoringPageSpec` fields that reached no prompt
	// for the application's whole life. Nothing reported that, because this check only ever looked
	// for the lines it was told to look for. These two tests are what stops it happening again: a
	// prompt that drops either line is now a reported violation rather than a silent no-op.
	//
	// The line is removed from a prompt the fixture proves is otherwise clean, so a failure here can
	// only be about the removed line.
	it.each([
		['lettering', 'Lettering: small, leaving the most room to colour.'],
		['whitespace', 'Whitespace: leave about 50% of the sheet blank; treat blank space as intentional.']
	])('adapter reports a prompt with no %s line', async (_name, line) => {
		const clean = driftDetectionSampleFixture.input;
		expect(clean.promptSent).toContain(line);

		const output = await driftDetectionAdapter.detect({
			...clean,
			promptSent: clean.promptSent
				.split('\n')
				.map((promptLine) => promptLine.replace(line, '').trimEnd())
				.join('\n')
		});

		expect(output.ok).toBe(true);
		if (!output.ok) return;
		expect(
			output.value.violations.filter(
				(violation) =>
					violation.code === 'MISSING_OPTION_LINE' && violation.message.includes(line)
			)
		).toHaveLength(1);
		expect(
			output.value.recommendedFixes.some(
				(fix) => fix.code === 'ADD_OPTION_LINE' && fix.message.includes(line)
			)
		).toBe(true);
	});
});
