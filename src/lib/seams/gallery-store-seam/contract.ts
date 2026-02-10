// Purpose: Define GalleryStoreSeam contract types.
// Why: Keep seam interfaces explicit and shared across implementations.
// Info flow: contract types -> adapters/mocks/tests.
import type { CompiledPrompt, PromptCompilerInput } from '../prompt-compiler-seam/contract';
import type { GeneratedImage } from '../image-generation-seam/contract';

export type GalleryRecord = {
  id: string;
  createdAt: string;
  request: PromptCompilerInput;
  compiled: CompiledPrompt;
  images: GeneratedImage[];
};

export type GalleryStoreSeam = {
  save: (record: GalleryRecord) => Promise<void>;
  listRecent: (limit: number) => Promise<GalleryRecord[]>;
};
