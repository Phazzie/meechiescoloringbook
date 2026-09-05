/*
 * Purpose: Provide deterministic fixture data for ProviderAdapterSeam.
 * Why: Back mock and contract testing with verified provider response shapes.
 * Info flow: Fixture JSON -> validated typed constants -> mocks/tests.
 * Invariants: Fixtures must conform to chat and image input/result schemas.
 */
import { z } from 'zod';
import {
	ProviderChatInputSchema,
	ProviderChatResultSchema,
	ProviderImageInputSchema,
	ProviderImageResultSchema
} from './contract';
import { ScenarioSchema } from '../../../../contracts/shared.contract';
import sampleJson from '../../../../fixtures/provider-adapter/sample.json';
import faultJson from '../../../../fixtures/provider-adapter/fault.json';

const fixtureSchema = z.object({
	scenario: ScenarioSchema,
	input: z.object({
		chat: ProviderChatInputSchema,
		image: ProviderImageInputSchema
	}),
	output: z.object({
		chat: ProviderChatResultSchema,
		image: ProviderImageResultSchema
	})
});

export const providerAdapterSampleFixture = fixtureSchema.parse(sampleJson);
export const providerAdapterFaultFixture = fixtureSchema.parse(faultJson);
