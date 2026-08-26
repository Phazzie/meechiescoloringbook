// Purpose: Mock WigTryOnSeam behavior using fixtures.
// Why: Keep tests deterministic without live provider calls.
// Info flow: tests -> mock -> fixtures.
import type { WigTryOnError, WigTryOnRequest, WigTryOnResult, WigTryOnSeam } from './contract';
import type { Result } from '../../../../contracts/shared.contract';
import {
  wigTryOnAbortedErrorFixture,
  wigTryOnConfigErrorFixture,
  wigTryOnEmptyResponseFixture,
  wigTryOnHttpErrorFixture,
  wigTryOnNetworkErrorFixture,
  wigTryOnParseErrorFixture,
  wigTryOnPortraitFixture,
  wigTryOnTimeoutErrorFixture,
  wigTryOnValidationErrorFixture
} from './fixtures';

export type WigTryOnMockScenario =
  | 'sample'
  | 'http_error'
  | 'config_error'
  | 'validation_error'
  | 'network_error'
  | 'empty_response'
  | 'parse_error'
  | 'timeout_error'
  | 'aborted';

const scenarioErrors: Partial<Record<WigTryOnMockScenario, WigTryOnError>> = {
  http_error: wigTryOnHttpErrorFixture,
  config_error: wigTryOnConfigErrorFixture,
  validation_error: wigTryOnValidationErrorFixture,
  network_error: wigTryOnNetworkErrorFixture,
  empty_response: wigTryOnEmptyResponseFixture,
  parse_error: wigTryOnParseErrorFixture,
  timeout_error: wigTryOnTimeoutErrorFixture,
  aborted: wigTryOnAbortedErrorFixture
};

export const createMockWigTryOnSeam = (
  scenario: WigTryOnMockScenario = 'sample'
): WigTryOnSeam => ({
  tryOn: async (_request: WigTryOnRequest): Promise<Result<WigTryOnResult, WigTryOnError>> => {
    const error = scenarioErrors[scenario];
    if (error) {
      return { ok: false, error };
    }

    return {
      ok: true,
      value: wigTryOnPortraitFixture
    };
  }
});
