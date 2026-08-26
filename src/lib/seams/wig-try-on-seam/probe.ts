// Purpose: Probe real WigTryOnSeam behavior against the configured image-edit provider.
// Why: Confirm the production multi-image edit request before claiming live compatibility.
// Info flow: synthetic selfie + packaged wig -> provider adapter -> secret-free acceptance evidence.
import type { WigTryOnRequest, WigTryOnSeam } from './contract';

export const probeWigTryOn = async (seam: WigTryOnSeam, request: WigTryOnRequest) =>
  seam.tryOn(request);
