// Purpose: Provide fixture data for TelemetrySeam.
// Why: Ensure deterministic mock and test inputs.
// Info flow: fixtures -> mocks/tests.
import type { TelemetryEvent } from './contract';

export const telemetryEventFixture: TelemetryEvent = {
  name: 'generation_requested',
  timestamp: '2025-01-01T00:00:00.000Z',
  metadata: { source: 'fixture' }
};
