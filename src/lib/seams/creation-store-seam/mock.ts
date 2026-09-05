/*
 * Purpose: Provide fixture-backed mock implementation of CreationStoreSeam.
 * Why: Ensure deterministic creation storage resolution during tests and verification.
 * Info flow: Scenario parameter -> input validated through the seam's validators -> selected
 *            fixture -> callers.
 * Invariants: A record or draft the adapter would refuse is refused here the same way; otherwise
 *             the fault scenario returns BROWSER_REQUIRED and the sample returns deterministic
 *             records.
 */
import type { CreationStoreSeam } from './contract';
import type { Scenario } from '../../../../contracts/shared.contract';
import { creationStoreSampleFixture, creationStoreFaultFixture } from './fixtures';
import { parseCreationRecord, validateDraftRecord } from './validators';

/**
 * The refusal the production adapter returns for a record that does not parse, restated here so
 * the mock cannot be greener than the thing it stands in for.
 *
 * This mock used to return its fixture's canned output whatever it was handed, so a consumer could
 * pass a record the adapter would reject, watch the mock accept it, and only find out in a browser.
 * The fault fixture's `rejected` payloads are what exercise this.
 */
const CREATION_SCHEMA_MISMATCH = {
	ok: false,
	error: {
		code: 'CREATION_SCHEMA_MISMATCH',
		message: 'Creation record failed schema validation.'
	}
} as const;

export const createCreationStoreMock = (scenario: Scenario = 'sample'): CreationStoreSeam => {
	const fixture = scenario === 'fault' ? creationStoreFaultFixture : creationStoreSampleFixture;
	return {
		saveCreation: async (input) =>
			parseCreationRecord(input.record).ok ? fixture.output.saveCreation : CREATION_SCHEMA_MISMATCH,
		listCreations: async () => fixture.output.listCreations,
		getCreation: async () => fixture.output.getCreation,
		deleteCreation: async () => fixture.output.deleteCreation,
		// Throws rather than returning a failure, because that is exactly what the adapter's
		// `saveDraft` does. The asymmetry with `saveCreation` above is the adapter's, mirrored on
		// purpose: a mock that reported a failure where the real thing throws would let a consumer
		// write a handler that never runs in production.
		saveDraft: async (input) => {
			validateDraftRecord(input.draft);
			return fixture.output.saveDraft;
		},
		getDraft: async () => fixture.output.getDraft,
		clearDraft: async () => fixture.output.clearDraft
	};
};
