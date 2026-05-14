// Purpose: Probe real behavior for ImageGenerationSeam.
// Why: Capture real outputs to refresh fixtures.
// Info flow: probe I/O -> recorded fixtures.
import type { ImageGenerationRequest, XaiImageProviderSeam } from './contract';

export const probeImageGenerationSeam = async (
  seam: XaiImageProviderSeam,
  request: ImageGenerationRequest
) => seam.generate(request);
