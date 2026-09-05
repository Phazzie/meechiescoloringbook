/*
 * Purpose: Provide fixture-backed mock implementation of CreationStoreSeam.
 * Why: Ensure deterministic creation storage resolution during tests and verification.
 * Info flow: Scenario parameter -> input validated through the seam's validators -> selected
 *            fixture -> callers.
 * Invariants: A record or draft the adapter would refuse is refused here the same way, and in the
 *             same ORDER — the adapter checks for a browser before it validates anything, so a
 *             scenario with no browser refuses on that and never reaches the validator. Otherwise
 *             the fault scenario returns BROWSER_REQUIRED and the sample returns deterministic
 *             records.
 */
import type { CreationStoreSeam } from './contract';
import type { Result, Scenario } from '../../../../contracts/shared.contract';
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

/**
 * This scenario has no browser, so the adapter would have refused before validating.
 *
 * Every guarded operation in the adapter opens with `typeof localStorage === 'undefined'` and
 * returns `BROWSER_REQUIRED` — *before* it parses anything. The validation added to this mock went
 * in front of that instead, so handing the fault scenario a malformed record produced
 * `CREATION_SCHEMA_MISMATCH`, and a malformed draft produced a thrown error, in an environment where
 * the adapter can produce neither. A consumer could write a handler for a result that cannot happen.
 *
 * Read off the fixture's own output rather than from `scenario === 'fault'`: the fixture is the
 * record of what the environment does, so a fault scenario added later whose failure is *not*
 * environmental correctly goes back to validating first.
 */
const refusedByEnvironment = (replay: Result<unknown>): boolean =>
	!replay.ok && replay.error.code === 'BROWSER_REQUIRED';

export const createCreationStoreMock = (scenario: Scenario = 'sample'): CreationStoreSeam => {
	const fixture = scenario === 'fault' ? creationStoreFaultFixture : creationStoreSampleFixture;
	return {
		saveCreation: async (input) => {
			const replay = fixture.output.saveCreation;
			if (refusedByEnvironment(replay)) return replay;
			return parseCreationRecord(input.record).ok ? replay : CREATION_SCHEMA_MISMATCH;
		},
		listCreations: async () => fixture.output.listCreations,
		getCreation: async () => fixture.output.getCreation,
		deleteCreation: async () => fixture.output.deleteCreation,
		// Throws rather than returning a failure, because that is exactly what the adapter's
		// `saveDraft` does. The asymmetry with `saveCreation` above is the adapter's, mirrored on
		// purpose: a mock that reported a failure where the real thing throws would let a consumer
		// write a handler that never runs in production.
		saveDraft: async (input) => {
			const replay = fixture.output.saveDraft;
			if (refusedByEnvironment(replay)) return replay;
			validateDraftRecord(input.draft);
			return replay;
		},
		getDraft: async () => fixture.output.getDraft,
		clearDraft: async () => fixture.output.clearDraft
	};
};
