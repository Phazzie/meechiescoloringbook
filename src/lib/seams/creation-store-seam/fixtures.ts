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

/**
 * Payloads the seam must refuse, held as `unknown` on purpose.
 *
 * The fault fixture's own inputs are valid records — its fault is in the *outputs*, every one of
 * them `BROWSER_REQUIRED`. So it proved the seam reports an unusable environment, and nothing at
 * all about a record whose stored style is wrong, which is the failure the style field introduced.
 * A review caught that the red proof the workflow requires had no fixture behind it.
 *
 * `z.unknown()` rather than a record schema, because the whole point of these is that they do not
 * parse: typing them as records would make the fixture module itself throw on import.
 */
const rejectedSchema = z.object({
	creationWithUnacceptableVoice: z.unknown(),
	creationWithEmptyThemeId: z.unknown(),
	draftWithStyleSelectionAsText: z.unknown()
});

export const creationStoreSampleFixture = fixtureSchema.parse(sampleJson);
export const creationStoreFaultFixture = fixtureSchema.parse(faultJson);

/** The fault fixture's deliberately-invalid payloads, for the seam's rejection tests. */
export const creationStoreRejectedFixtures = rejectedSchema.parse(
	(faultJson as { rejected: unknown }).rejected
);
