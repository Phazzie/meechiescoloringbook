// Purpose: Mock ImageGenerationSeam behavior using fixtures.
// Why: Keep tests deterministic without live I/O.
// Info flow: tests -> mock -> fixtures.
import type {
  ImageGenerationRequest,
  ImageGenerationResult,
  ImageGenerationSeam
} from './contract';
import type { Result } from '../../../../contracts/shared.contract';
import { imageGenerationFaultFixture } from './fixtures';

const buildSvg = (label: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><text y="50">${label}</text></svg>`;

const toDataUrl = (svg: string) => `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;

export const createMockImageGenerationSeam = (
  scenario: 'sample' | 'fault' = 'sample'
): ImageGenerationSeam => ({
  generate: async (request: ImageGenerationRequest): Promise<Result<ImageGenerationResult, typeof imageGenerationFaultFixture>> => {
    if (scenario === 'fault') {
      return {
        ok: false,
        error: imageGenerationFaultFixture
      };
    }

    const start = Date.now();
    const images = Array.from({ length: request.n }, (_, index) => {
      const label = `Mock Image ${index + 1}`;
      const svg = buildSvg(label);
      const id = `mock-${index + 1}`;
      return request.format === 'b64_json'
        ? { id, b64: Buffer.from(svg).toString('base64') }
        : { id, url: toDataUrl(svg) };
    });

    return {
      ok: true,
      value: {
        images,
        rawModelInfo: { provider: 'mock', request },
        timingMs: Date.now() - start
      }
    };
  }
});
