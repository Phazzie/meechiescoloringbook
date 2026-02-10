// Purpose: Probe real behavior for AppConfigSeam.
// Why: Capture real outputs to refresh fixtures.
// Info flow: probe I/O -> recorded fixtures.
import type { AppConfigSeam } from './contract';

export const probeAppConfigSeam = (seam: AppConfigSeam) => seam.getConfig();
