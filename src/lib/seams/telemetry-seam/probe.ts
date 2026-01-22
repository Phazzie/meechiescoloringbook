import type { TelemetryEvent, TelemetrySeam } from './contract';

export const probeTelemetrySeam = (seam: TelemetrySeam, event: TelemetryEvent) =>
  seam.emit(event);
