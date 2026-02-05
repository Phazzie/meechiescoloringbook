// Purpose: Contract tests for CreationStoreSeam using fixture-backed mocks.
// Why: Ensure storage contract remains deterministic and environment-gated.
// Info flow: Fixtures -> mock/adapter -> assertions.
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import {
	CreationRecordResultSchema,
	CreationListResultSchema,
	DeleteResultSchema,
	DraftDeleteResultSchema,
	DraftSaveResultSchema,
	DraftResultSchema,
	SaveCreationInputSchema,
	ListCreationsInputSchema,
	GetCreationInputSchema,
	DeleteCreationInputSchema,
	SaveDraftInputSchema,
	GetDraftInputSchema,
	ClearDraftInputSchema
} from '../../contracts/creation-store.contract';
import { ScenarioSchema } from '../../contracts/shared.contract';
import { createCreationStoreMock } from '../../src/lib/mocks/creation-store.mock';
import { creationStoreAdapter } from '../../src/lib/adapters/creation-store.adapter';
import sample from '../../fixtures/creation-store/sample.json';
import fault from '../../fixtures/creation-store/fault.json';

const fixtureSchema = z.object({
	scenario: ScenarioSchema,
	input: z.object({
		saveCreation: SaveCreationInputSchema,
		listCreations: ListCreationsInputSchema,
		getCreation: GetCreationInputSchema,
		deleteCreation: DeleteCreationInputSchema,
		saveDraft: SaveDraftInputSchema,
		getDraft: GetDraftInputSchema,
		clearDraft: ClearDraftInputSchema
	}),
	output: z.object({
		saveCreation: CreationRecordResultSchema,
		listCreations: CreationListResultSchema,
		getCreation: CreationRecordResultSchema,
		deleteCreation: DeleteResultSchema,
		saveDraft: DraftSaveResultSchema,
		getDraft: DraftResultSchema,
		clearDraft: DraftDeleteResultSchema
	})
});

const sampleFixture = fixtureSchema.parse(sample);
const faultFixture = fixtureSchema.parse(fault);

describe('CreationStoreSeam contract', () => {
	it('mock returns sample fixture outputs', async () => {
		const mock = createCreationStoreMock('sample');
		expect(await mock.saveCreation(sampleFixture.input.saveCreation)).toEqual(
			sampleFixture.output.saveCreation
		);
		expect(await mock.listCreations(sampleFixture.input.listCreations)).toEqual(
			sampleFixture.output.listCreations
		);
		expect(await mock.getCreation(sampleFixture.input.getCreation)).toEqual(
			sampleFixture.output.getCreation
		);
		expect(await mock.deleteCreation(sampleFixture.input.deleteCreation)).toEqual(
			sampleFixture.output.deleteCreation
		);
		expect(await mock.saveDraft(sampleFixture.input.saveDraft)).toEqual(
			sampleFixture.output.saveDraft
		);
		expect(await mock.getDraft(sampleFixture.input.getDraft)).toEqual(
			sampleFixture.output.getDraft
		);
		expect(await mock.clearDraft(sampleFixture.input.clearDraft)).toEqual(
			sampleFixture.output.clearDraft
		);
	});

	it('mock returns fault fixture outputs', async () => {
		const mock = createCreationStoreMock('fault');
		expect(await mock.saveCreation(faultFixture.input.saveCreation)).toEqual(
			faultFixture.output.saveCreation
		);
		expect(await mock.listCreations(faultFixture.input.listCreations)).toEqual(
			faultFixture.output.listCreations
		);
		expect(await mock.getCreation(faultFixture.input.getCreation)).toEqual(
			faultFixture.output.getCreation
		);
		expect(await mock.deleteCreation(faultFixture.input.deleteCreation)).toEqual(
			faultFixture.output.deleteCreation
		);
		expect(await mock.saveDraft(faultFixture.input.saveDraft)).toEqual(
			faultFixture.output.saveDraft
		);
		expect(await mock.getDraft(faultFixture.input.getDraft)).toEqual(
			faultFixture.output.getDraft
		);
		expect(await mock.clearDraft(faultFixture.input.clearDraft)).toEqual(
			faultFixture.output.clearDraft
		);
	});

	it('adapter returns browser-gated errors in non-browser environments', async () => {
		if (typeof localStorage === 'undefined') {
			expect(await creationStoreAdapter.saveCreation(sampleFixture.input.saveCreation)).toEqual(
				faultFixture.output.saveCreation
			);
			expect(await creationStoreAdapter.listCreations(sampleFixture.input.listCreations)).toEqual(
				faultFixture.output.listCreations
			);
			expect(await creationStoreAdapter.getCreation(sampleFixture.input.getCreation)).toEqual(
				faultFixture.output.getCreation
			);
			expect(await creationStoreAdapter.deleteCreation(sampleFixture.input.deleteCreation)).toEqual(
				faultFixture.output.deleteCreation
			);
			expect(await creationStoreAdapter.saveDraft(sampleFixture.input.saveDraft)).toEqual(
				faultFixture.output.saveDraft
			);
			expect(await creationStoreAdapter.getDraft(sampleFixture.input.getDraft)).toEqual(
				faultFixture.output.getDraft
			);
			expect(await creationStoreAdapter.clearDraft(sampleFixture.input.clearDraft)).toEqual(
				faultFixture.output.clearDraft
			);
		}
	});
});
