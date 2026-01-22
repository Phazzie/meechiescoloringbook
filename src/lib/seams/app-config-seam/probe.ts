import type { AppConfigSeam } from './contract';

export const probeAppConfigSeam = (seam: AppConfigSeam) => seam.getConfig();
