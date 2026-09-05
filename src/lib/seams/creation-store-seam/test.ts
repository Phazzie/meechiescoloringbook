/*
 * Purpose: Contract and unit verification for CreationStoreSeam.
 * Why: Ensure CreationStoreSeam contract invariants hold across scenarios.
 * Info flow: Fixtures -> Mock/Contract -> Vitest assertions.
 * Invariants: Fault scenario returns BROWSER_REQUIRED across all operations; sample returns valid record shapes.
 */
import { describe, expect, it } from 'vitest';
import { CreationRecordSchema, DraftRecordSchema } from './contract';
import { creationStoreSampleFixture, creationStoreFaultFixture } from './fixtures';
import { createCreationStoreMock } from './mock';

describe('CreationStoreSeam contract (self-contained)', () => {
	it('accepts optional Meechie studio text snapshots on creations and drafts', () => {
		const studioText = {
			verdict: 'Meechie ruled on it.',
			quote: 'The quote survives the prompt.',
			pageTitle: 'QUOTE SURVIVES',
			pageItems: [
				{ number: 1, label: 'SAVE THE LINE' },
				{ number: 2, label: 'LOAD THE LINE' }
			],
			qualityState: 'ready' as const
		};

		expect(
			CreationRecordSchema.parse({
				...creationStoreSampleFixture.input.saveCreation.record,
				studioText
			}).studioText
		).toEqual(studioText);

		expect(
			DraftRecordSchema.parse({
				...creationStoreSampleFixture.input.saveDraft.draft,
				studioText
			}).studioText
		).toEqual(studioText);
	});

	it('mock returns sample fixture outputs', async () => {
		const mock = createCreationStoreMock('sample');
		expect(await mock.saveCreation(creationStoreSampleFixture.input.saveCreation)).toEqual(
			creationStoreSampleFixture.output.saveCreation
		);
		expect(await mock.listCreations(creationStoreSampleFixture.input.listCreations)).toEqual(
			creationStoreSampleFixture.output.listCreations
		);
		expect(await mock.getCreation(creationStoreSampleFixture.input.getCreation)).toEqual(
			creationStoreSampleFixture.output.getCreation
		);
		expect(await mock.deleteCreation(creationStoreSampleFixture.input.deleteCreation)).toEqual(
			creationStoreSampleFixture.output.deleteCreation
		);
		expect(await mock.saveDraft(creationStoreSampleFixture.input.saveDraft)).toEqual(
			creationStoreSampleFixture.output.saveDraft
		);
		expect(await mock.getDraft(creationStoreSampleFixture.input.getDraft)).toEqual(
			creationStoreSampleFixture.output.getDraft
		);
		expect(await mock.clearDraft(creationStoreSampleFixture.input.clearDraft)).toEqual(
			creationStoreSampleFixture.output.clearDraft
		);
	});

	it('mock returns fault fixture outputs (BROWSER_REQUIRED)', async () => {
		const mock = createCreationStoreMock('fault');
		const operations = [
			mock.saveCreation(creationStoreFaultFixture.input.saveCreation),
			mock.listCreations(creationStoreFaultFixture.input.listCreations),
			mock.getCreation(creationStoreFaultFixture.input.getCreation),
			mock.deleteCreation(creationStoreFaultFixture.input.deleteCreation),
			mock.saveDraft(creationStoreFaultFixture.input.saveDraft),
			mock.getDraft(creationStoreFaultFixture.input.getDraft),
			mock.clearDraft(creationStoreFaultFixture.input.clearDraft)
		];

		const results = await Promise.all(operations);
		for (const res of results) {
			expect(res.ok).toBe(false);
			if (!res.ok) {
				expect(res.error.code).toBe('BROWSER_REQUIRED');
				expect(res.error.message).toBe('Creation store requires a browser environment.');
			}
		}
	});
});
