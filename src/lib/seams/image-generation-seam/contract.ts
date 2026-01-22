export type ImageFormat = 'url' | 'b64_json';

export type ImageGenerationRequest = {
  prompt: string;
  negativePrompt: string;
  n: number;
  size: string;
  format: ImageFormat;
  seed?: number;
  userTag?: string;
};

export type GeneratedImage = {
  id: string;
  url?: string;
  b64?: string;
};

export type ImageGenerationResult = {
  images: GeneratedImage[];
  rawModelInfo: Record<string, unknown>;
  timingMs: number;
};

export type ImageGenerationSeam = {
  generate: (request: ImageGenerationRequest) => Promise<ImageGenerationResult>;
};
