// Purpose: Unit tests for creation-store adapter helper functions and edge cases.
// Why: Ensure localStorage operations, record parsing, and owner matching work correctly.
// Info flow: Storage operations -> adapter methods -> verified results.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { creationStoreAdapter } from '../../src/lib/adapters/creation-store.adapter';

const validIntent = {
	title: 'Test',
	items: [{ number: 1, label: 'Item' }],
	listMode: 'list' as const,
	alignment: 'left' as const,
	numberAlignment: 'strict' as const,
	listGutter: 'normal' as const,
	whitespaceScale: 50,
	textSize: 'small' as const,
	fontStyle: 'rounded' as const,
	textStrokeWidth: 6,
	colorMode: 'black_and_white_only' as const,
	decorations: 'none' as const,
	illustrations: 'none' as const,
	shading: 'none' as const,
	border: 'plain' as const,
	borderThickness: 8,
	variations: 1,
	outputFormat: 'pdf' as const,
	pageSize: 'US_Letter' as const
};

const validRecord = {
	id: 'creation-1',
	createdAtISO: '2026-01-01T00:00:00.000Z',
	intent: validIntent,
	assembledPrompt: 'Create a black-and-white coloring book page for print.',
	revisedPrompt: 'deterministic-svg renderer (no revision)',
	images: [{ b64: 'c3R1Yi1pbWFnZQ==' }],
	favorite: false,
	violations: [],
	fixesApplied: [],
	owner: { kind: 'anonymous' as const, sessionId: 'session-123' }
};

const validDraft = {
	updatedAtISO: '2026-01-01T00:00:00.000Z',
	intent: validIntent,
	chatMessage: 'Make a checklist about growth'
};

describe('creation-store adapter', () => {
	beforeEach(() => {
		// jsdom provides localStorage
		localStorage.clear();
	});

	afterEach(() => {
		localStorage.clear();
	});

	describe('saveCreation and getCreation', () => {
		it('saves and retrieves a creation record', async () => {
			const saveResult = await creationStoreAdapter.saveCreation({
				record: validRecord
			});
			expect(saveResult.ok).toBe(true);

			const getResult = await creationStoreAdapter.getCreation({
				id: 'creation-1'
			});
			expect(getResult.ok).toBe(true);
			if (getResult.ok) {
				expect(getResult.value).toEqual(validRecord);
			}
		});

		it('returns null for nonexistent creation', async () => {
			const result = await creationStoreAdapter.getCreation({
				id: 'nonexistent-id'
			});
			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value).toBeNull();
			}
		});

		it('upserts existing record by id', async () => {
			await creationStoreAdapter.saveCreation({ record: validRecord });

			const updatedRecord = {
				...validRecord,
				intent: { ...validRecord.intent, title: 'Updated Title' }
			};
			await creationStoreAdapter.saveCreation({ record: updatedRecord });

			const listResult = await creationStoreAdapter.listCreations({
				owner: validRecord.owner
			});
			expect(listResult.ok).toBe(true);
			if (listResult.ok) {
				expect(listResult.value).toHaveLength(1);
				expect(listResult.value[0].intent.title).toBe('Updated Title');
			}
		});
	});

	describe('listCreations with owner matching', () => {
		it('filters by anonymous session ID', async () => {
			await creationStoreAdapter.saveCreation({ record: validRecord });
			await creationStoreAdapter.saveCreation({
				record: {
					...validRecord,
					id: 'creation-2',
					owner: { kind: 'anonymous' as const, sessionId: 'other-session' }
				}
			});

			const result = await creationStoreAdapter.listCreations({
				owner: { kind: 'anonymous', sessionId: 'session-123' }
			});
			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value).toHaveLength(1);
				expect(result.value[0].id).toBe('creation-1');
			}
		});

		it('does not match anonymous owner to authenticated owner', async () => {
			await creationStoreAdapter.saveCreation({ record: validRecord });

			const result = await creationStoreAdapter.listCreations({
				owner: { kind: 'authenticated' as const, userId: 'session-123' }
			});
			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value).toHaveLength(0);
			}
		});

		it('matches authenticated owner by userId', async () => {
			const authRecord = {
				...validRecord,
				id: 'auth-creation-1',
				owner: { kind: 'authenticated' as const, userId: 'user-abc' }
			};
			await creationStoreAdapter.saveCreation({ record: authRecord });

			const result = await creationStoreAdapter.listCreations({
				owner: { kind: 'authenticated', userId: 'user-abc' }
			});
			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value).toHaveLength(1);
			}
		});
	});

	describe('deleteCreation', () => {
		it('deletes an existing creation and returns true', async () => {
			await creationStoreAdapter.saveCreation({ record: validRecord });

			const result = await creationStoreAdapter.deleteCreation({
				id: 'creation-1'
			});
			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value).toBe(true);
			}

			const getResult = await creationStoreAdapter.getCreation({
				id: 'creation-1'
			});
			expect(getResult.ok).toBe(true);
			if (getResult.ok) {
				expect(getResult.value).toBeNull();
			}
		});

		it('returns false when deleting nonexistent creation', async () => {
			const result = await creationStoreAdapter.deleteCreation({
				id: 'nonexistent-id'
			});
			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value).toBe(false);
			}
		});
	});

	describe('draft operations', () => {
		it('saves and retrieves a draft', async () => {
			const saveResult = await creationStoreAdapter.saveDraft({
				draft: validDraft
			});
			expect(saveResult.ok).toBe(true);

			const getResult = await creationStoreAdapter.getDraft({});
			expect(getResult.ok).toBe(true);
			if (getResult.ok) {
				expect(getResult.value).toEqual(validDraft);
			}
		});

		it('returns null when no draft exists', async () => {
			const result = await creationStoreAdapter.getDraft({});
			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value).toBeNull();
			}
		});

		it('clears a saved draft', async () => {
			await creationStoreAdapter.saveDraft({ draft: validDraft });

			const clearResult = await creationStoreAdapter.clearDraft({});
			expect(clearResult.ok).toBe(true);

			const getResult = await creationStoreAdapter.getDraft({});
			expect(getResult.ok).toBe(true);
			if (getResult.ok) {
				expect(getResult.value).toBeNull();
			}
		});
	});

	describe('corrupted storage', () => {
		it('returns parse error when stored creations are not valid JSON', async () => {
			localStorage.setItem('cb_creations_v1', 'not-valid-json');

			const result = await creationStoreAdapter.listCreations({
				owner: { kind: 'anonymous', sessionId: 'session-123' }
			});
			expect(result.ok).toBe(false);
			if (!result.ok) {
				expect(result.error.code).toBe('STORAGE_PARSE_FAILED');
			}
		});

		it('returns schema error when stored creations are not an array', async () => {
			localStorage.setItem('cb_creations_v1', JSON.stringify({ not: 'array' }));

			const result = await creationStoreAdapter.listCreations({
				owner: { kind: 'anonymous', sessionId: 'session-123' }
			});
			expect(result.ok).toBe(false);
			if (!result.ok) {
				expect(result.error.code).toBe('STORAGE_SCHEMA_MISMATCH');
			}
		});

		it('returns schema error when stored creation record fails validation', async () => {
			localStorage.setItem(
				'cb_creations_v1',
				JSON.stringify([{ id: 'bad', invalid: true }])
			);

			const result = await creationStoreAdapter.listCreations({
				owner: { kind: 'anonymous', sessionId: 'session-123' }
			});
			expect(result.ok).toBe(false);
			if (!result.ok) {
				expect(result.error.code).toBe('STORAGE_SCHEMA_MISMATCH');
			}
		});

		it('returns schema error when stored draft fails validation', async () => {
			localStorage.setItem('cb_drafts_v1', JSON.stringify({ invalid: true }));

			const result = await creationStoreAdapter.getDraft({});
			expect(result.ok).toBe(false);
			if (!result.ok) {
				expect(result.error.code).toBe('DRAFT_SCHEMA_MISMATCH');
			}
		});
	});

	describe('MAX_CREATIONS limit', () => {
		it('limits stored creations to maximum', async () => {
			// Save 51 records to exceed the 50 max
			for (let i = 0; i < 51; i++) {
				await creationStoreAdapter.saveCreation({
					record: {
						...validRecord,
						id: `creation-${i}`
					}
				});
			}

			const result = await creationStoreAdapter.listCreations({
				owner: { kind: 'anonymous' as const, sessionId: 'session-123' }
			});
			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value.length).toBeLessThanOrEqual(50);
			}
		});
	});
});
