// Purpose: Probe real behavior for TelemetrySeam.
// Why: Capture real outputs to refresh fixtures.
// Info flow: probe I/O -> recorded fixtures.
import type { TelemetryEvent, TelemetrySeam } from './contract';

export const probeTelemetrySeam = (seam: TelemetrySeam, event: TelemetryEvent) =>
  seam.emit(event);
