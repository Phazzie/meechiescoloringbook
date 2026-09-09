/*
 * Purpose: Provide fixture-backed mock implementation of CreationStoreSeam.
 * Why: Ensure deterministic creation storage resolution during tests and verification.
 * Info flow: Scenario parameter -> input validated through the seam's validators -> selected
 *            fixture -> callers.
 * Invariants: A record or draft the adapter would refuse is refused here the same way, and in the
 *             same ORDER — the adapter checks for a browser before it validates anything, so a
 *             scenario with no browser refuses on that and never reaches the validator, and it
 *             validates before it asks about capacity. That last refusal is stateful, so this mock
 *             keeps the records it has been handed and asks `planCreationWrite` about them — the
 *             same pure function the adapter asks — rather than replaying success forever. Every
 *             successful output still comes from the fixture; the store here only decides whether
 *             a save is one. Otherwise the fault scenario returns BROWSER_REQUIRED and the sample
 *             returns deterministic records.
 */
import type { CreationRecord, CreationStoreSeam } from './contract';
import type { Result, Scenario } from '../../../../contracts/shared.contract';
import { creationStoreSampleFixture, creationStoreFaultFixture } from './fixtures';
import { parseCreationRecord, validateDraftRecord } from './validators';
import { planCreationWrite } from '../../core/vault-capacity';

/**
 * The failure code each capacity refusal is reported under, restated from the adapter so the two
 * cannot answer the same refusal with different codes.
 */
const REFUSAL_CODES = {
	RECORD_CAP: 'VAULT_FULL',
	ID_COLLISION: 'VAULT_ID_COLLISION'
} as const;

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
	/**
	 * What this mock has been handed, so it can refuse a save for capacity the way the adapter does.
	 *
	 * Not invented data: it holds only records the caller itself passed in, and the accept/refuse
	 * decision is `planCreationWrite` — the same pure function the production adapter asks, rather
	 * than a second rule written here that could disagree with it. The fixture still supplies every
	 * successful *output*; this only decides whether the save is one.
	 *
	 * It exists because a review found the mock greener than the thing it stands in for. The mock's
	 * own invariant is that a record the adapter would refuse is refused here the same way, and
	 * capacity refusals are stateful — a consumer driving fifty-one saves through the mock got fifty-
	 * one successes and would meet the refusal for the first time in a browser.
	 */
	const stored: CreationRecord[] = [];
	return {
		saveCreation: async (input) => {
			const replay = fixture.output.saveCreation;
			if (refusedByEnvironment(replay)) return replay;
			const parsed = parseCreationRecord(input.record);
			if (!parsed.ok) return CREATION_SCHEMA_MISMATCH;
			const plan = planCreationWrite(stored, parsed.value);
			if (!plan.ok) {
				return {
					ok: false,
					error: { code: REFUSAL_CODES[plan.reason], message: plan.message }
				};
			}
			stored.length = 0;
			stored.push(...plan.records);
			return replay;
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
			// Guarding the validation rather than returning early, because the environment does not
			// change what this replays — only whether the draft is checked on the way. Written as an
			// early return first, which returned the same value on both paths and so said,
			// structurally, that the branch decided the result. It does not.
			if (!refusedByEnvironment(replay)) {
				validateDraftRecord(input.draft);
			}
			return replay;
		},
		getDraft: async () => fixture.output.getDraft,
		clearDraft: async () => fixture.output.clearDraft
	};
};
