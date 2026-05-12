/*
 * Purpose: Provide fixture data for AppConfigSeam.
 * Why: Ensure deterministic mock and test inputs.
 * Info flow: fixtures -> mocks/tests.
 */
import { appConfigSchema } from '../../seams/app-config-seam/validators';
import type { AppConfig } from './contract';
import sampleFixture from '../../../../fixtures/app-config/sample.json';
import faultFixture from '../../../../fixtures/app-config/fault.json';

// The sample fixture is the contract-conforming reference — parse it at module
// load so any drift between fixtures/app-config/sample.json and the schema
// surfaces as a ZodError instead of a downstream surprise.
export const appConfigFixture = appConfigSchema.parse(sampleFixture);

// The fault fixture is INTENTIONALLY invalid (empty xaiApiKey, maxImagesPerRequest=0).
// Its job is to make validateAppConfig() throw inside the .toThrow() test below.
// We cannot run it through appConfigSchema.parse() at module load — that would
// throw at import time and break every consumer of this module. Keep it as a
// typed-cast of the raw JSON so the type system stays accurate, even though
// runtime validation will (correctly) reject it.
export const appConfigFaultFixture = faultFixture as unknown as AppConfig;

export const getAppConfigFixture = (scenario: 'sample' | 'fault' = 'sample') =>
  scenario === 'fault' ? appConfigFaultFixture : appConfigFixture;
