/*
 * Purpose: Provide deterministic fixture data for CreationStoreSeam.
 * Why: Back mock and contract testing with verified fixture shapes.
 * Info flow: Fixture JSON -> validated typed constants -> mocks/tests.
 * Invariants: Fixtures must conform strictly to CreationStoreSeam contract schemas.
 */
import { z } from 'zod';
import {
	ClearDraftInputSchema,
	CreationListResultSchema,
	CreationRecordResultSchema,
	DeleteCreationInputSchema,
	DeleteResultSchema,
	DraftDeleteResultSchema,
	DraftResultSchema,
	DraftSaveResultSchema,
	GetCreationInputSchema,
	GetDraftInputSchema,
	ListCreationsInputSchema,
	SaveCreationInputSchema,
	SaveDraftInputSchema
} from './contract';
import { ScenarioSchema } from '../../../../contracts/shared.contract';
import sampleJson from '../../../../fixtures/creation-store/sample.json';
import faultJson from '../../../../fixtures/creation-store/fault.json';

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

export const creationStoreSampleFixture = fixtureSchema.parse(sampleJson);
export const creationStoreFaultFixture = fixtureSchema.parse(faultJson);
