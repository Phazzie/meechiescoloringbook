// Purpose: Contract tests for TelemetrySeam.
// Why: Enforce mock adherence to the seam contract.
// Info flow: tests -> mock -> contract assertions.
import { describe, expect, it } from 'vitest';
import { telemetryEventFixture } from './fixtures';
import { createMockTelemetrySeam, mockTelemetryStore } from './mock';
import { validateTelemetryEvent } from './validators';

describe('TelemetrySeam mock contract', () => {
  it('accepts telemetry events', () => {
    mockTelemetryStore.length = 0;
    const seam = createMockTelemetrySeam(mockTelemetryStore);
    seam.emit(telemetryEventFixture);

    expect(mockTelemetryStore).toEqual([telemetryEventFixture]);
    expect(validateTelemetryEvent(mockTelemetryStore[0])).toEqual(telemetryEventFixture);
  });
});
