// Purpose: Contract tests for AppConfigSeam.
// Why: Enforce mock adherence to the seam contract.
// Info flow: tests -> mock -> contract assertions.
import { describe, expect, it } from 'vitest';
import { appConfigFixture } from './fixtures';
import { createMockAppConfigSeam } from './mock';
import { validateAppConfig } from './validators';

describe('AppConfigSeam mock contract', () => {
  it('returns a validated config', () => {
    const seam = createMockAppConfigSeam(appConfigFixture);
    const config = seam.getConfig();
    expect(config).toEqual(appConfigFixture);
    expect(validateAppConfig(config)).toEqual(appConfigFixture);
  });
});
