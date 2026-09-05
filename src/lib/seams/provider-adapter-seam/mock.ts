/*
 * Purpose: Provide fixture-backed mock implementation of ProviderAdapterSeam.
 * Why: Keep external AI provider boundary deterministic during tests without real network calls.
 * Info flow: Scenario parameter -> selected fixture -> callers.
 * Invariants: Fault scenario returns PROVIDER_HTTP_ERROR; sample returns valid chat and image outputs.
 */
import type { ProviderAdapterSeam } from './contract';
import type { Scenario } from '../../../../contracts/shared.contract';
import { providerAdapterSampleFixture, providerAdapterFaultFixture } from './fixtures';

export const createProviderAdapterMock = (scenario: Scenario = 'sample'): ProviderAdapterSeam => ({
	createChatCompletion: async () =>
		scenario === 'fault'
			? providerAdapterFaultFixture.output.chat
			: providerAdapterSampleFixture.output.chat,
	createImageGeneration: async () =>
		scenario === 'fault'
			? providerAdapterFaultFixture.output.image
			: providerAdapterSampleFixture.output.image
});
