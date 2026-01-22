import type {
  ImageGenerationRequest,
  ImageGenerationResult,
  ImageGenerationSeam
} from './contract';

const buildSvg = (label: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512"><rect width="100%" height="100%" fill="white"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" font-family="Arial" font-size="24" fill="black">${label}</text></svg>`;

const toDataUrl = (svg: string) => `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;

export const createMockImageGenerationSeam = (): ImageGenerationSeam => ({
  generate: async (request: ImageGenerationRequest): Promise<ImageGenerationResult> => {
    const start = Date.now();
    const images = Array.from({ length: request.n }, (_, index) => {
      const label = `Mock Image ${index + 1}`;
      const svg = buildSvg(label);
      return {
        id: `mock-${index + 1}`,
        url: request.format === 'url' ? toDataUrl(svg) : undefined,
        b64: request.format === 'b64_json' ? Buffer.from(svg).toString('base64') : undefined
      };
    });

    return {
      images,
      rawModelInfo: { provider: 'mock', request },
      timingMs: Date.now() - start
    };
  }
});
