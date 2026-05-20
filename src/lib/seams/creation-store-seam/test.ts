// Purpose: Contract tests for CreationStoreSeam using fixture-backed mocks.
// Why: Ensure storage contract remains deterministic and environment-gated.
// Info flow: Fixtures -> mock/adapter -> assertions.
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import {
	CreationListResultSchema,
	CreationRecordResultSchema,
	CreationRecordSchema,
	DeleteResultSchema,
	DraftDeleteResultSchema,
	DraftRecordSchema,
	DraftResultSchema,
	DraftSaveResultSchema,
	SaveCreationInputSchema,
	ListCreationsInputSchema,
	GetCreationInputSchema,
	DeleteCreationInputSchema,
	SaveDraftInputSchema,
	GetDraftInputSchema,
	ClearDraftInputSchema
} from './contract';
import { ScenarioSchema } from '../../../../contracts/shared.contract';
import { createCreationStoreMock } from './mock';
import { creationStoreAdapter } from '../../adapters/creation-store-seam';
import { creationStoreSampleFixture, creationStoreFaultFixture } from './fixtures';

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

const sampleFixture = fixtureSchema.parse(creationStoreSampleFixture);
const faultFixture = fixtureSchema.parse(creationStoreFaultFixture);

describe('CreationStoreSeam contract', () => {
	it('accepts optional Meechie studio text snapshots on creations and drafts', () => {
		const studioText = {
			verdict: 'Meechie ruled on it.',
			quote: 'The quote survives the prompt.',
			pageTitle: 'QUOTE SURVIVES',
			pageItems: [
				{ number: 1, label: 'SAVE THE LINE' },
				{ number: 2, label: 'LOAD THE LINE' }
			],
			qualityState: 'ready'
		};

		expect(
			CreationRecordSchema.parse({
				...sampleFixture.input.saveCreation.record,
				studioText
			}).studioText
		).toEqual(studioText);
		expect(
			DraftRecordSchema.parse({
				...sampleFixture.input.saveDraft.draft,
				studioText
			}).studioText
		).toEqual(studioText);
	});

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

describe('CreationStoreSeam adapter browser-environment behavior', () => {
	// These tests run in jsdom where localStorage is set up by tests/setup/local-storage.ts.
	// localStorage is cleared before each test by the setup file.

	it('adapter saves a creation and retrieves it by id', async () => {
		if (typeof localStorage === 'undefined') return;

		const saveResult = await creationStoreAdapter.saveCreation(sampleFixture.input.saveCreation);
		expect(saveResult.ok).toBe(true);

		const getResult = await creationStoreAdapter.getCreation(sampleFixture.input.getCreation);
		expect(getResult.ok).toBe(true);
		if (getResult.ok) {
			expect(getResult.value?.id).toBe(sampleFixture.input.saveCreation.record.id);
		}
	});

	it('adapter lists creations filtered by owner', async () => {
		if (typeof localStorage === 'undefined') return;

		await creationStoreAdapter.saveCreation(sampleFixture.input.saveCreation);

		const listResult = await creationStoreAdapter.listCreations(sampleFixture.input.listCreations);
		expect(listResult.ok).toBe(true);
		if (listResult.ok) {
			expect(listResult.value.length).toBeGreaterThanOrEqual(1);
			expect(listResult.value[0].id).toBe(sampleFixture.input.saveCreation.record.id);
		}
	});

	it('adapter returns null for a getCreation on a missing id', async () => {
		if (typeof localStorage === 'undefined') return;

		const getResult = await creationStoreAdapter.getCreation({ id: 'nonexistent-id-xyz' });
		expect(getResult.ok).toBe(true);
		if (getResult.ok) {
			expect(getResult.value).toBeNull();
		}
	});

	it('adapter deleteCreation returns true when a creation exists and false when absent', async () => {
		if (typeof localStorage === 'undefined') return;

		await creationStoreAdapter.saveCreation(sampleFixture.input.saveCreation);

		const deleteResult = await creationStoreAdapter.deleteCreation(
			sampleFixture.input.deleteCreation
		);
		expect(deleteResult.ok).toBe(true);
		if (deleteResult.ok) {
			expect(deleteResult.value).toBe(true);
		}

		// Second delete on the same id — already removed, should return false.
		const deleteMissResult = await creationStoreAdapter.deleteCreation(
			sampleFixture.input.deleteCreation
		);
		expect(deleteMissResult.ok).toBe(true);
		if (deleteMissResult.ok) {
			expect(deleteMissResult.value).toBe(false);
		}
	});

	it('adapter saves a draft and retrieves it', async () => {
		if (typeof localStorage === 'undefined') return;

		const saveResult = await creationStoreAdapter.saveDraft(sampleFixture.input.saveDraft);
		expect(saveResult.ok).toBe(true);

		const getResult = await creationStoreAdapter.getDraft(sampleFixture.input.getDraft);
		expect(getResult.ok).toBe(true);
		if (getResult.ok) {
			expect(getResult.value).not.toBeNull();
		}
	});

	it('adapter getDraft returns null when no draft has been saved', async () => {
		if (typeof localStorage === 'undefined') return;

		// localStorage is cleared before each test by the setup file.
		const getResult = await creationStoreAdapter.getDraft(sampleFixture.input.getDraft);
		expect(getResult.ok).toBe(true);
		if (getResult.ok) {
			expect(getResult.value).toBeNull();
		}
	});

	it('adapter clearDraft removes the stored draft', async () => {
		if (typeof localStorage === 'undefined') return;

		await creationStoreAdapter.saveDraft(sampleFixture.input.saveDraft);

		const clearResult = await creationStoreAdapter.clearDraft(sampleFixture.input.clearDraft);
		expect(clearResult.ok).toBe(true);

		const getResult = await creationStoreAdapter.getDraft(sampleFixture.input.getDraft);
		expect(getResult.ok).toBe(true);
		if (getResult.ok) {
			expect(getResult.value).toBeNull();
		}
	});

	it('adapter rejects a creation record that fails schema validation', async () => {
		if (typeof localStorage === 'undefined') return;

		const invalidRecord = {
			...sampleFixture.input.saveCreation,
			record: {
				...sampleFixture.input.saveCreation.record,
				id: '' // Empty id violates NonEmptyString
			}
		};

		const result = await creationStoreAdapter.saveCreation(invalidRecord as Parameters<typeof creationStoreAdapter.saveCreation>[0]);
		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error.code).toBe('CREATION_SCHEMA_MISMATCH');
		}
	});
});
