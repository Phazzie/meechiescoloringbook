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
      url: 'data:image/svg+xml;utf8,%3Csvg%3Emock%3C/svg%3E'
    }
  ]
};
