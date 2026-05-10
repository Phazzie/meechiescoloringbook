/*
 * Purpose: Provide fixture data for AppConfigSeam.
 * Why: Ensure deterministic mock and test inputs.
 * Info flow: fixtures -> mocks/tests.
 */
import { appConfigSchema } from '../../seams/app-config-seam/validators';
import sampleFixture from '../../../../fixtures/app-config/sample.json';
import faultFixture from '../../../../fixtures/app-config/fault.json';

// These are validated at module load time. If the JSON diverges from the
// schema, the parse() call will throw a ZodError immediately, catching drift
// before any test or mock consumes the fixture.
export const appConfigFixture = appConfigSchema.parse(sampleFixture);
export const appConfigFaultFixture = appConfigSchema.parse(faultFixture);

export const getAppConfigFixture = (scenario: 'sample' | 'fault' = 'sample') =>
  scenario === 'fault' ? appConfigFaultFixture : appConfigFixture;
