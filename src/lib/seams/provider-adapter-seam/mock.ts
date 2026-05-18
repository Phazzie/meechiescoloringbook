// Purpose: Fixture-backed mock for ProviderAdapterSeam.
// Why: Keep provider boundary deterministic during tests.
// Info flow: Scenario -> fixture output -> callers.
import { z } from 'zod';
import {
	ProviderChatInputSchema,
	ProviderChatResultSchema,
	ProviderImageInputSchema,
	ProviderImageResultSchema
} from './contract';
import type { ProviderAdapterSeam } from './contract';
import { ScenarioSchema } from '../../../../contracts/shared.contract';
import type { Scenario } from '../../../../contracts/shared.contract';
import { providerAdapterSampleFixture, providerAdapterFaultFixture } from './fixtures';

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

const sampleFixture = fixtureSchema.parse(providerAdapterSampleFixture);
const faultFixture = fixtureSchema.parse(providerAdapterFaultFixture);

export const createProviderAdapterMock = (scenario: Scenario): ProviderAdapterSeam => ({
	createChatCompletion: async () =>
		scenario === 'fault' ? faultFixture.output.chat : sampleFixture.output.chat,
	createImageGeneration: async () =>
		scenario === 'fault' ? faultFixture.output.image : sampleFixture.output.image
});
