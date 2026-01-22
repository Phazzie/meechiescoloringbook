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
