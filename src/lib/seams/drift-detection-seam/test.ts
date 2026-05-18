// Purpose: Contract tests for DriftDetectionSeam using fixture-backed mocks.
// Why: Ensure drift rules are deterministic and auditable.
// Info flow: Fixtures -> mock/adapter -> assertions.
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import {
	DriftDetectionInputSchema,
	DriftDetectionResultSchema
} from './contract';
import { ScenarioSchema } from '../../../../contracts/shared.contract';
import { createDriftDetectionMock } from './mock';
import { driftDetectionAdapter } from '../../adapters/drift-detection-seam';
import {
	driftDetectionSampleFixture,
	driftDetectionFaultFixture,
	driftDetectionTitleOnlyFixture
} from './fixtures';

const fixtureSchema = z.object({
	scenario: ScenarioSchema,
	input: DriftDetectionInputSchema,
	output: DriftDetectionResultSchema
});

const sampleFixture = fixtureSchema.parse(driftDetectionSampleFixture);
const faultFixture = fixtureSchema.parse(driftDetectionFaultFixture);
const titleOnlyFixture = fixtureSchema.parse(driftDetectionTitleOnlyFixture);

describe('DriftDetectionSeam contract', () => {
	it('mock returns sample fixture output', async () => {
		const mock = createDriftDetectionMock('sample');
		const output = await mock.detect(sampleFixture.input);
		expect(output).toEqual(sampleFixture.output);
	});

	it('mock returns fault fixture output', async () => {
		const mock = createDriftDetectionMock('fault');
		const output = await mock.detect(faultFixture.input);
		expect(output).toEqual(faultFixture.output);
	});

	it('adapter returns sample fixture output', async () => {
		const output = await driftDetectionAdapter.detect(sampleFixture.input);
		expect(output).toEqual(sampleFixture.output);
	});

	it('adapter returns fault fixture output', async () => {
		const output = await driftDetectionAdapter.detect(faultFixture.input);
		expect(output).toEqual(faultFixture.output);
	});

	it('adapter returns title-only fixture output', async () => {
		const output = await driftDetectionAdapter.detect(titleOnlyFixture.input);
		expect(output).toEqual(titleOnlyFixture.output);
	});
});
