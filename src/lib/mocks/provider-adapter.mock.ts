// Purpose: Fixture-backed mock for ProviderAdapterSeam.
// Why: Keep provider boundary deterministic during tests.
// Info flow: Scenario -> fixture output -> callers.
import { z } from 'zod';
import {
	ProviderChatInputSchema,
	ProviderChatResultSchema,
	ProviderImageInputSchema,
	ProviderImageResultSchema
} from '../../../contracts/provider-adapter.contract';
import type { ProviderAdapterSeam } from '../../../contracts/provider-adapter.contract';
import { ScenarioSchema } from '../../../contracts/shared.contract';
import type { Scenario } from '../../../contracts/shared.contract';
import sample from '../../../fixtures/provider-adapter/sample.json';
import fault from '../../../fixtures/provider-adapter/fault.json';

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

const sampleFixture = fixtureSchema.parse(sample);
const faultFixture = fixtureSchema.parse(fault);

export const createProviderAdapterMock = (scenario: Scenario): ProviderAdapterSeam => ({
	createChatCompletion: async () =>
		scenario === 'fault' ? faultFixture.output.chat : sampleFixture.output.chat,
	createImageGeneration: async () =>
		scenario === 'fault' ? faultFixture.output.image : sampleFixture.output.image
});
