// Purpose: Contract tests for DriftDetectionSeam.
// Why: Enforce mock and adapter adherence to the seam contract.
// Info flow: fixtures -> mock/adapter -> assertions.
import { describe, expect, it } from 'vitest';
import {
	driftDetectionSampleFixture,
	driftDetectionFaultFixture,
	driftDetectionTitleOnlyFixture
} from './fixtures';
import { createDriftDetectionMock } from './mock';
import { driftDetectionAdapter } from '../../adapters/drift-detection.adapter';

describe('DriftDetectionSeam mock contract', () => {
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
});

describe('DriftDetectionSeam adapter contract', () => {
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
});
