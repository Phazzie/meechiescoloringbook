/*
 * Purpose: Provide fixture-backed mock implementation of CreationStoreSeam.
 * Why: Ensure deterministic creation storage resolution during tests and verification.
 * Info flow: Scenario parameter -> selected fixture -> callers.
 * Invariants: Fault scenario returns BROWSER_REQUIRED; sample returns deterministic records.
 */
import type { CreationStoreSeam } from './contract';
import type { Scenario } from '../../../../contracts/shared.contract';
import { creationStoreSampleFixture, creationStoreFaultFixture } from './fixtures';

export const createCreationStoreMock = (scenario: Scenario = 'sample'): CreationStoreSeam => {
	const fixture = scenario === 'fault' ? creationStoreFaultFixture : creationStoreSampleFixture;
	return {
		saveCreation: async () => fixture.output.saveCreation,
		listCreations: async () => fixture.output.listCreations,
		getCreation: async () => fixture.output.getCreation,
		deleteCreation: async () => fixture.output.deleteCreation,
		saveDraft: async () => fixture.output.saveDraft,
		getDraft: async () => fixture.output.getDraft,
		clearDraft: async () => fixture.output.clearDraft
	};
};
