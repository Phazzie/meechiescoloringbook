// Purpose: Console-based TelemetrySeam adapter for server-side event logging.
// Why: Route TelemetrySeam.emit() through structured console.log so events are
//      visible in Vercel function logs without adding an external analytics dependency.
// Info flow: Pipeline stage -> createConsoleTelemetrySeam().emit() -> console.log(JSON).
import type { TelemetrySeam, TelemetryEvent } from '../../seams/telemetry-seam/contract';

export const createConsoleTelemetrySeam = (): TelemetrySeam => ({
	emit: (event: TelemetryEvent): void => {
		console.log(JSON.stringify({ telemetry: event }));
	}
});
