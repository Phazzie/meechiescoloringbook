// Purpose: An AppOriginSeam that reports a fixed origin from the fixtures.
// Why: Same-origin behaviour must be drivable without a browser and without depending on the host
//      the suite runs on.
// Info flow: test -> createMockAppOriginSeam(scenario) -> fixture origin.
import type { AppOriginSeam } from './contract';
import { missingOrigin, otherOrigin, sampleOrigin } from './fixtures';

export type AppOriginScenario = 'sample' | 'other' | 'missing';

const ORIGINS: Record<AppOriginScenario, string> = {
	sample: sampleOrigin,
	other: otherOrigin,
	missing: missingOrigin
};

export const createMockAppOriginSeam = (
	scenario: AppOriginScenario = 'sample'
): AppOriginSeam => ({
	getOrigin: () => ORIGINS[scenario]
});
