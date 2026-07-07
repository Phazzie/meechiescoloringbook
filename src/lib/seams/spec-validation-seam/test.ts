// Purpose: Contract tests for SpecValidationSeam using fixture-backed mocks.
// Why: Ensure fixture inputs/outputs align with the contract before adapters.
// Info flow: Fixtures -> mock -> assertions.
import { describe, expect, it } from 'vitest';
import {
	specValidationSampleFixture,
	specValidationFaultFixture,
	specValidationTitleOnlyFixture,
	specValidationMaxItemsFixture
} from './fixtures';
import { createSpecValidationMock } from './mock';
import { specValidationAdapter } from '../../adapters/spec-validation-seam';

describe('SpecValidationSeam contract', () => {
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

	it('adapter returns a stable message for generic enum/format failures regardless of zod version wording', async () => {
		const input = {
			spec: { ...specValidationSampleFixture.input.spec, alignment: 'diagonal' }
		};
		const output = await specValidationAdapter.validate(input);
		expect(output).toEqual({
			ok: false,
			issues: [{ code: 'SPEC_INVALID', field: 'alignment', message: 'Invalid value for alignment.' }]
		});
	});
});
