import type { ImageGenerationRequest, ImageGenerationSeam } from './contract';

export const probeImageGenerationSeam = async (
  seam: ImageGenerationSeam,
  request: ImageGenerationRequest
) => seam.generate(request);
