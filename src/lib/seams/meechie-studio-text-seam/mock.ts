/*
 * Purpose: Provide fixture-backed mock implementation of MeechieStudioTextSeam.
 * Why: Keep AI text contract tests deterministic without provider calls.
 * Info flow: Scenario parameter -> selected fixture -> callers.
 * Invariants: Fault scenario returns MEECHIE_STUDIO_TEXT_PROVIDER_INVALID; sample returns valid Meechie text output.
 */
import type { MeechieStudioTextSeam } from './contract';
import type { Scenario } from '../../../../contracts/shared.contract';
import { meechieStudioTextSampleFixture, meechieStudioTextFaultFixture } from './fixtures';

export const createMeechieStudioTextMock = (scenario: Scenario = 'sample'): MeechieStudioTextSeam => ({
	respond: async () =>
		scenario === 'fault' ? meechieStudioTextFaultFixture.output : meechieStudioTextSampleFixture.output
});
