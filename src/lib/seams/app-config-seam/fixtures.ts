// Purpose: Provide fixture data for AppConfigSeam.
// Why: Ensure deterministic mock and test inputs.
// Info flow: fixtures -> mocks/tests.
import type { AppConfig } from './contract';
import { appConfigSchema } from './validators';
import sampleFixture from '../../../../fixtures/app-config/sample.json';
import faultFixture from '../../../../fixtures/app-config/fault.json';

export const appConfigFixture: AppConfig = appConfigSchema.parse(sampleFixture);
// Intentionally invalid — used to exercise error paths in contract tests
export const appConfigFaultFixture = faultFixture as unknown as AppConfig;

export const getAppConfigFixture = (scenario: 'sample' | 'fault' = 'sample'): AppConfig =>
  scenario === 'fault' ? appConfigFaultFixture : appConfigFixture;
