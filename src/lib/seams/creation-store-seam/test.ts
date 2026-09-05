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

	it('accepts an optional style selection on creations and drafts, and round-trips the wig', () => {
		const styleSelection = {
			themeId: 'receipts',
			voice: {
				intensity: 'no_mercy' as const,
				rawness: 'raw' as const,
				thirdPerson: 'always' as const
			},
			glitter: true,
			wig: { name: 'Honey Drip', style: 'body wave' }
		};

		expect(
			CreationRecordSchema.parse({
				...creationStoreSampleFixture.input.saveCreation.record,
				styleSelection
			}).styleSelection
		).toEqual(styleSelection);

		expect(
			DraftRecordSchema.parse({
				...creationStoreSampleFixture.input.saveDraft.draft,
				styleSelection
			}).styleSelection
		).toEqual(styleSelection);
	});

	it('leaves records written before styles were stored valid, with no selection invented', () => {
		// The field is optional precisely so every record already in a reader's browser keeps
		// parsing. If this ever became required, the adapter would drop those records on the floor
		// as schema failures — the vault would silently empty itself on upgrade.
		const legacyRecord = { ...creationStoreSampleFixture.input.saveCreation.record };
		delete (legacyRecord as { styleSelection?: unknown }).styleSelection;

		const parsed = CreationRecordSchema.parse(legacyRecord);
		expect(parsed.styleSelection).toBeUndefined();
	});

	it('rejects a style selection whose voice is not one the text seam accepts', () => {
		// The voice schema is shared with MeechieStudioTextSeam rather than restated, so a value
		// that seam would refuse cannot be stored here and handed back to it on restore.
		expect(
			CreationRecordSchema.safeParse({
				...creationStoreSampleFixture.input.saveCreation.record,
				styleSelection: {
					themeId: 'receipts',
					voice: { intensity: 'polite', rawness: 'raw', thirdPerson: 'always' },
					glitter: false
				}
			}).success
		).toBe(false);
	});

	it('carries the style selection through the mock, not only through the schema', async () => {
		// The fixture is what the mandated mock replays, so a field the fixture does not carry is a
		// field no consumer tested against the mock can notice losing. Parsing the schema directly
		// proves the shape is legal; this proves the seam actually hands it back.
		const mock = createCreationStoreMock('sample');
		const expected = creationStoreSampleFixture.input.saveCreation.record.styleSelection;
		expect(expected).toBeDefined();

		const saved = await mock.saveCreation(creationStoreSampleFixture.input.saveCreation);
		expect(saved.ok && saved.value.styleSelection).toEqual(expected);

		const fetched = await mock.getCreation(creationStoreSampleFixture.input.getCreation);
		expect(fetched.ok && fetched.value?.styleSelection).toEqual(expected);

		const listed = await mock.listCreations(creationStoreSampleFixture.input.listCreations);
		expect(listed.ok).toBe(true);
		if (listed.ok) {
			expect(listed.value.length).toBeGreaterThan(0);
			for (const record of listed.value) {
				expect(record.styleSelection).toEqual(expected);
			}
		}

		const draft = await mock.getDraft(creationStoreSampleFixture.input.getDraft);
		expect(draft.ok && draft.value?.styleSelection).toEqual(
			creationStoreSampleFixture.input.saveDraft.draft.styleSelection
		);
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
