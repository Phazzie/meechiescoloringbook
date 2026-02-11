// Purpose: Contract tests for AppConfigSeam.
// Why: Enforce mock adherence to the seam contract.
// Info flow: tests -> mock -> contract assertions.
import { describe, expect, it } from 'vitest';
import { appConfigFixture, appConfigFaultFixture } from './fixtures';
import { createMockAppConfigSeam } from './mock';
import { validateAppConfig } from './validators';

describe('AppConfigSeam mock contract', () => {
  it('returns a validated config', () => {
    const seam = createMockAppConfigSeam('sample');
    const config = seam.getConfig();
    expect(config).toEqual(appConfigFixture);
    expect(validateAppConfig(config)).toEqual(appConfigFixture);
  });

  it('fault fixture fails validation', () => {
    const seam = createMockAppConfigSeam('fault');
    const config = seam.getConfig();
    expect(config).toEqual(appConfigFaultFixture);
    expect(() => validateAppConfig(config)).toThrow();
  });
});
