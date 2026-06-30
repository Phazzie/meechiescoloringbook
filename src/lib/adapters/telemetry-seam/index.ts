// Purpose: Console-based TelemetrySeam adapter for server-side event logging.
// Why: Route TelemetrySeam.emit() through structured console.log so events are
//      visible in Vercel function logs without adding an external analytics dependency.
// Info flow: Pipeline stage -> createConsoleTelemetrySeam().emit() -> console.log(JSON).
import type { TelemetrySeam, TelemetryEvent } from '../../seams/telemetry-seam/contract';

export const createConsoleTelemetrySeam = (): TelemetrySeam => ({
	emit: (event: TelemetryEvent): void => {
		try {
			console.log(JSON.stringify({ telemetry: event }));
		} catch (err) {
			console.log(JSON.stringify({
				telemetry: {
					name: event.name,
					timestamp: event.timestamp,
					metadata: { serialization_error: err instanceof Error ? err.message : String(err) }
				}
			}));
		}
	}
});
