// Purpose: Fixture-backed mock for CreationStoreSeam.
// Why: Provide deterministic storage behavior for contract tests.
// Info flow: Scenario -> fixture outputs -> callers.
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
} from './contract';
import type { CreationStoreSeam } from './contract';
import { ScenarioSchema } from '../../../../contracts/shared.contract';
import type { Scenario } from '../../../../contracts/shared.contract';
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

export const createCreationStoreMock = (scenario: Scenario): CreationStoreSeam => {
	const fixture = scenario === 'fault' ? faultFixture : sampleFixture;
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
