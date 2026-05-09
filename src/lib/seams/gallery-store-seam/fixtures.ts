// Purpose: Provide fixture data for GalleryStoreSeam.
// Why: Ensure deterministic mock and test inputs.
// Info flow: fixtures -> mocks/tests.
import type { GalleryRecord } from './contract';
import { compiledPromptFixture, promptCompilerInputFixture } from '../prompt-compiler-seam/fixtures';

export const galleryRecordFixture: GalleryRecord = {
  id: 'record-1',
  createdAt: '2025-01-01T00:00:00.000Z',
  request: promptCompilerInputFixture,
  compiled: compiledPromptFixture,
  images: [
    {
      id: 'mock-1',
      format: 'png',
      mimeType: 'image/png',
      data: 'bW9jay1pbWFnZQ==',
      encoding: 'base64'
    }
  ]
};
