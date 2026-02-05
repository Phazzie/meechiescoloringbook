// Purpose: Contract tests for DriftDetectionSeam using fixture-backed mocks.
// Why: Ensure drift rules are deterministic and auditable.
// Info flow: Fixtures -> mock/adapter -> assertions.
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import {
	DriftDetectionInputSchema,
	DriftDetectionResultSchema
} from '../../contracts/drift-detection.contract';
import { ScenarioSchema } from '../../contracts/shared.contract';
import { createDriftDetectionMock } from '../../src/lib/mocks/drift-detection.mock';
import { driftDetectionAdapter } from '../../src/lib/adapters/drift-detection.adapter';
import sample from '../../fixtures/drift-detection/sample.json';
import fault from '../../fixtures/drift-detection/fault.json';
import titleOnly from '../../fixtures/drift-detection/title-only.json';

const fixtureSchema = z.object({
	scenario: ScenarioSchema,
	input: DriftDetectionInputSchema,
	output: DriftDetectionResultSchema
});

const sampleFixture = fixtureSchema.parse(sample);
const faultFixture = fixtureSchema.parse(fault);
const titleOnlyFixture = fixtureSchema.parse(titleOnly);

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
