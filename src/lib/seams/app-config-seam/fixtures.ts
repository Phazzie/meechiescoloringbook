// Purpose: Provide fixture data for AppConfigSeam.
// Why: Ensure deterministic mock and test inputs.
// Info flow: fixtures -> mocks/tests.
import type { AppConfig } from './contract';
import sampleFixture from '../../../../fixtures/app-config/sample.json';
import faultFixture from '../../../../fixtures/app-config/fault.json';

export const appConfigFixture = sampleFixture as AppConfig;
export const appConfigFaultFixture = faultFixture as AppConfig;

export const getAppConfigFixture = (scenario: 'sample' | 'fault' = 'sample'): AppConfig =>
  scenario === 'fault' ? appConfigFaultFixture : appConfigFixture;
