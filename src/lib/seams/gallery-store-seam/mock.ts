// Purpose: Mock GalleryStoreSeam behavior using fixtures.
// Why: Keep tests deterministic without live I/O.
// Info flow: tests -> mock -> fixtures.
import type { GalleryRecord, GalleryStoreSeam } from './contract';
import { galleryRecordFixture } from './fixtures';

export const createMockGalleryStoreSeam = (scenario: 'empty' | 'sample' = 'empty'): GalleryStoreSeam => {
  const records: GalleryRecord[] = scenario === 'sample' ? [structuredClone(galleryRecordFixture)] : [];

  return {
    save: async (record) => {
      records.unshift(structuredClone(record));
    },
    listRecent: async (limit) => records.slice(0, limit).map((record) => structuredClone(record))
  };
};
