/*
 * Purpose: Contract and unit verification for CreationStoreSeam.
 * Why: Ensure CreationStoreSeam contract invariants hold across scenarios.
 * Info flow: Fixtures -> Mock/Contract -> Vitest assertions.
 * Invariants: Fault scenario returns BROWSER_REQUIRED across all operations; sample returns valid record shapes.
 */
import { describe, expect, it } from 'vitest';
import { CreationRecordSchema, DraftRecordSchema } from './contract';
import type { CreationRecord, DraftRecord } from './contract';
import {
	creationStoreSampleFixture,
	creationStoreFaultFixture,
	creationStoreRejectedFixtures
} from './fixtures';
import { createCreationStoreMock } from './mock';
import {
	parseCreationRecord,
	parseDraftRecord,
	validateCreationRecord,
	validateDraftRecord,
	validateStyleSelection
} from './validators';

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

	// The validators are the seam's only parse of stored JSON — the production adapter routes all
	// four of its parse sites through them. They were added as the required artifact and imported by
	// nowhere, so these exercise the two shapes the adapter actually depends on: reporting without
	// throwing, and throwing where a failure is a programming error.
	it('reports a bad record rather than throwing, and hands back the parsed one', () => {
		const record = creationStoreSampleFixture.input.saveCreation.record;

		const good = parseCreationRecord(record);
		expect(good.ok).toBe(true);
		// The parsed value, not just a verdict: the vault read keeps what parses and skips the rest,
		// so a validator that answered only yes/no could not be used by the path it exists for.
		expect(good.ok && good.value.id).toBe(record.id);

		expect(parseCreationRecord({ id: 'no-such-shape' }).ok).toBe(false);
		expect(parseCreationRecord(null).ok).toBe(false);
	});

	it('reports a bad draft the same way', () => {
		const draft = creationStoreSampleFixture.input.saveDraft.draft;

		const good = parseDraftRecord(draft);
		expect(good.ok).toBe(true);
		expect(good.ok && good.value.intent.title).toBe(draft.intent.title);

		expect(parseDraftRecord({ updatedAtISO: 'not a draft' }).ok).toBe(false);
	});

	it('throws where a failure is a programming error rather than bad stored data', () => {
		expect(validateCreationRecord(creationStoreSampleFixture.input.saveCreation.record)).toEqual(
			creationStoreSampleFixture.input.saveCreation.record
		);
		expect(validateDraftRecord(creationStoreSampleFixture.input.saveDraft.draft)).toEqual(
			creationStoreSampleFixture.input.saveDraft.draft
		);
		expect(() => validateCreationRecord({})).toThrow();
		expect(() => validateDraftRecord({})).toThrow();
	});

	it('validates a style selection on its own, for a caller holding only that', () => {
		const styleSelection = creationStoreSampleFixture.input.saveCreation.record.styleSelection;
		expect(styleSelection).toBeDefined();
		expect(validateStyleSelection(styleSelection)).toEqual(styleSelection);
		expect(() =>
			validateStyleSelection({ themeId: '', voice: {}, glitter: false })
		).toThrow();
	});

	// The fault fixture's own inputs are valid records — its fault is that every output is
	// BROWSER_REQUIRED — so it proved the seam reports an unusable environment and nothing about a
	// record whose stored style is wrong. These drive the fixture's `rejected` payloads through the
	// validators the adapter uses, which is the red proof the style field never had.
	it('refuses every record the fault fixture says it must, through the adapter’s own validators', () => {
		const { creationWithUnacceptableVoice, creationWithEmptyThemeId, draftWithStyleSelectionAsText } =
			creationStoreRejectedFixtures;

		expect(parseCreationRecord(creationWithUnacceptableVoice).ok).toBe(false);
		expect(parseCreationRecord(creationWithEmptyThemeId).ok).toBe(false);
		expect(parseDraftRecord(draftWithStyleSelectionAsText).ok).toBe(false);

		expect(() => validateCreationRecord(creationWithUnacceptableVoice)).toThrow();
		expect(() => validateDraftRecord(draftWithStyleSelectionAsText)).toThrow();
	});

	// Driven through the MOCK, not only through the validators. The mock used to return its canned
	// fixture output whatever it was handed, so a record the adapter refuses would sail through it —
	// and a consumer verified against the mock would only find out in a browser. This is the
	// mock/adapter agreement the fault fixture exists to prove.
	it('mock refuses a record the adapter would refuse, rather than replaying its fixture', async () => {
		// The SAMPLE scenario, which is the one that has a browser. A review caught this asserted
		// against `fault`, where the adapter never reaches its validator at all — so the test proved
		// the mock validates, in the one scenario where validating is the wrong answer.
		const mock = createCreationStoreMock('sample');

		const refused = await mock.saveCreation({
			record: creationStoreRejectedFixtures.creationWithUnacceptableVoice as CreationRecord
		});
		expect(refused.ok).toBe(false);
		expect(refused.ok === false && refused.error.code).toBe('CREATION_SCHEMA_MISMATCH');

		// And the same mock still replays its fixture for a record that does parse, so the refusal
		// above is about the record rather than about the scenario.
		const replayed = await mock.saveCreation({
			record: creationStoreSampleFixture.input.saveCreation.record
		});
		expect(replayed.ok).toBe(true);
	});

	it('mock refuses a draft the adapter would refuse, the same way the adapter does', async () => {
		// The adapter's `saveDraft` throws rather than returning a failure. The mock mirrors that
		// deliberately: reporting a failure where the real thing throws would let a consumer write a
		// handler that never runs in production.
		const mock = createCreationStoreMock('sample');

		await expect(
			mock.saveDraft({
				draft: creationStoreRejectedFixtures.draftWithStyleSelectionAsText as DraftRecord
			})
		).rejects.toThrow();

		await expect(
			mock.saveDraft({ draft: creationStoreSampleFixture.input.saveDraft.draft })
		).resolves.toMatchObject({ ok: true });
	});

	it('refuses on the missing browser before it looks at the record at all', async () => {
		// The order is the finding, and it is the adapter's: every guarded operation opens with
		// `typeof localStorage === 'undefined'` and returns BROWSER_REQUIRED *before* parsing. The
		// mock validated first, so the fault scenario answered a malformed record with
		// CREATION_SCHEMA_MISMATCH and a malformed draft with a thrown error — two results the
		// adapter cannot produce with no browser. A consumer verified against this mock could write a
		// handler for a case that never happens, which is the same "greener than the real thing" the
		// validation was added to stop, one step further in.
		const mock = createCreationStoreMock('fault');

		const refused = await mock.saveCreation({
			record: creationStoreRejectedFixtures.creationWithUnacceptableVoice as CreationRecord
		});
		expect(refused.ok === false && refused.error.code).toBe('BROWSER_REQUIRED');

		// And the draft resolves rather than throwing, for the same reason: the validator is never
		// reached.
		await expect(
			mock.saveDraft({
				draft: creationStoreRejectedFixtures.draftWithStyleSelectionAsText as DraftRecord
			})
		).resolves.toMatchObject({ ok: false, error: { code: 'BROWSER_REQUIRED' } });
	});

	it('refuses them for the style, not for something else in the record', () => {
		// Without this the previous test would pass for a fixture that is malformed in some unrelated
		// way — green for the wrong reason, which is the failure mode a fault fixture is most prone
		// to. Each payload is the fault fixture's own valid record with only `styleSelection`
		// replaced, so stripping that field must make it parse.
		for (const rejected of [
			creationStoreRejectedFixtures.creationWithUnacceptableVoice,
			creationStoreRejectedFixtures.creationWithEmptyThemeId
		]) {
			const withoutStyle = { ...(rejected as Record<string, unknown>) };
			delete withoutStyle.styleSelection;
			expect(parseCreationRecord(withoutStyle).ok).toBe(true);
		}

		const draftWithoutStyle = {
			...(creationStoreRejectedFixtures.draftWithStyleSelectionAsText as Record<string, unknown>)
		};
		delete draftWithoutStyle.styleSelection;
		expect(parseDraftRecord(draftWithoutStyle).ok).toBe(true);
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

	it('reads back out of storage exactly what went in, per the probe capture', () => {
		// The outputs in `fixtures/creation-store/sample.json` are what
		// `probes/browser-seams.probe.mjs` read back out of a real browser's `localStorage` after
		// writing the inputs into it. That distinction had gone missing: the outputs were being
		// hand-maintained alongside the inputs, and had drifted — the committed `getCreation` carried
		// no `studioText` while the record saved into storage does, so the fixture asserted that
		// browser storage drops a field it in fact keeps.
		//
		// Every schema and mock test above runs against these outputs, so a hand-edit that quietly
		// loses `styleSelection` on the way back out would leave all of them green. This is the one
		// that goes red, and it is the reason to re-run the probe rather than edit the file.
		const { input, output } = creationStoreSampleFixture;

		expect(output.getCreation.ok && output.getCreation.value).toEqual(input.saveCreation.record);
		expect(output.getDraft.ok && output.getDraft.value).toEqual(input.saveDraft.draft);
		expect(output.listCreations.ok && output.listCreations.value).toContainEqual(
			input.saveCreation.record
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
