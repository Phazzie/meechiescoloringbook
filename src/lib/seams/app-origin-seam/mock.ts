// Purpose: An AppOriginSeam that reports a fixture origin, including the malformed ones.
// Why: Same-origin behaviour must be drivable without a browser and without depending on the host
//      the suite runs on — and the fault scenarios must be drivable through the mock too, so the
//      "mock fails on its fault fixture" proof exercises the same degradation path the adapter uses
//      rather than calling the validator directly.
// Info flow: test -> createMockAppOriginSeam(scenario) -> fixture value -> toSafeOrigin -> origin.
import type { AppOriginSeam } from './contract';
import {
	malformedOrigin,
	missingOrigin,
	nonHttpOrigin,
	originWithPath,
	originWithTrailingSlash,
	otherOrigin,
	sampleOrigin
} from './fixtures';
import { toSafeOrigin } from './validators';

export type AppOriginScenario =
	| 'sample'
	| 'other'
	| 'missing'
	| 'withPath'
	| 'trailingSlash'
	| 'nonHttp'
	| 'malformed';

/** What the host hands back in each scenario, before the seam has had a look at it. */
const RAW_ORIGINS: Record<AppOriginScenario, string> = {
	sample: sampleOrigin,
	other: otherOrigin,
	missing: missingOrigin,
	withPath: originWithPath,
	trailingSlash: originWithTrailingSlash,
	nonHttp: nonHttpOrigin,
	malformed: malformedOrigin
};

export const createMockAppOriginSeam = (
	scenario: AppOriginScenario = 'sample'
): AppOriginSeam => ({
	// Runs the fixture through the same validator the adapter uses, so a fault scenario degrades
	// here exactly as it would in a browser. A mock that simply returned the malformed value would
	// be reporting something the real seam can never report.
	getOrigin: () => toSafeOrigin(RAW_ORIGINS[scenario])
});
