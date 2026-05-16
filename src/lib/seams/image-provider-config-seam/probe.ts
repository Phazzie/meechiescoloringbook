// Purpose: Probe real behavior for ImageProviderConfigSeam.
// Why: Capture real outputs to refresh fixtures.
// Info flow: probe I/O -> recorded fixtures.
import type { ImageProviderConfigSeam } from './contract';

export const probeImageProviderConfigSeam = (seam: ImageProviderConfigSeam) =>
  seam.getConfig();
