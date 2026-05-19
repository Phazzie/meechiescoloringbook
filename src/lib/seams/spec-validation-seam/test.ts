// Purpose: Contract tests for SpecValidationSeam.
// Why: Enforce mock and adapter adherence to the seam contract.
// Info flow: fixtures -> mock/adapter -> assertions.
import { describe, expect, it } from 'vitest';
import {
	specValidationSampleFixture,
	specValidationFaultFixture,
	specValidationTitleOnlyFixture,
	specValidationMaxItemsFixture
} from './fixtures';
import { createSpecValidationMock } from './mock';
import { specValidationAdapter } from '../../adapters/spec-validation.adapter';

describe('SpecValidationSeam mock contract', () => {
	it('mock returns sample fixture output', async () => {
		const mock = createSpecValidationMock('sample');
		const output = await mock.validate(specValidationSampleFixture.input);
		expect(output).toEqual(specValidationSampleFixture.output);
	});

	it('mock returns fault fixture output', async () => {
		const mock = createSpecValidationMock('fault');
		const output = await mock.validate(specValidationFaultFixture.input);
		expect(output).toEqual(specValidationFaultFixture.output);
	});
});

describe('SpecValidationSeam adapter contract', () => {
	it('adapter returns sample fixture output', async () => {
		const output = await specValidationAdapter.validate(specValidationSampleFixture.input);
		expect(output).toEqual(specValidationSampleFixture.output);
	});

	it('adapter returns fault fixture output', async () => {
		const output = await specValidationAdapter.validate(specValidationFaultFixture.input);
		expect(output).toEqual(specValidationFaultFixture.output);
	});

	it('adapter returns title-only fixture output', async () => {
		const output = await specValidationAdapter.validate(specValidationTitleOnlyFixture.input);
		expect(output).toEqual(specValidationTitleOnlyFixture.output);
	});

	it('adapter rejects specs with too many items', async () => {
		const output = await specValidationAdapter.validate(specValidationMaxItemsFixture.input);
		expect(output).toEqual(specValidationMaxItemsFixture.output);
	});
});
