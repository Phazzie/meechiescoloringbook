/*
 * Purpose: Provide fixture-backed mock implementation of OutputPackagingSeam.
 * Why: Ensure deterministic packaging simulation during tests and verification without DOM canvas dependencies.
 * Info flow: Scenario parameter -> selected fixture -> callers.
 * Invariants: Fault scenario returns NO_IMAGES error; sample returns packaged PDF and PNG files.
 */
import type { OutputPackagingSeam } from './contract';
import type { Scenario } from '../../../../contracts/shared.contract';
import { outputPackagingSampleFixture, outputPackagingFaultFixture } from './fixtures';

export const createOutputPackagingMock = (scenario: Scenario = 'sample'): OutputPackagingSeam => ({
	package: async () => (scenario === 'fault' ? outputPackagingFaultFixture.output : outputPackagingSampleFixture.output)
});
