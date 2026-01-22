import type { TelemetryEvent, TelemetrySeam } from './contract';

export const createMockTelemetrySeam = (store: TelemetryEvent[] = []): TelemetrySeam => ({
  emit: (event) => {
    store.push(event);
  }
});

export const mockTelemetryStore: TelemetryEvent[] = [];
