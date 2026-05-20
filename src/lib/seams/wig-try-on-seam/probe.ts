// Purpose: Probe real WigTryOnSeam behavior against the live Gemini API.
// Why: Capture real outputs to refresh fixtures; run manually to verify API changes.
// Info flow: probe I/O -> recorded fixtures.
import type { WigTryOnRequest, WigTryOnSeam } from './contract';

export const probeWigTryOn = async (
	seam: WigTryOnSeam,
	request: WigTryOnRequest
) => seam.tryOn(request);
