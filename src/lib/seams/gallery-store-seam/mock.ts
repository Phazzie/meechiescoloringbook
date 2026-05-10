// Purpose: Mock GalleryStoreSeam behavior using fixtures.
// Why: Keep tests deterministic without live I/O.
// Info flow: tests -> mock -> fixtures.
// TODO: Refactor to load from fixture scenarios per SDD conventions (requires probe run with XAI_API_KEY)
import type { GalleryRecord, GalleryStoreSeam } from './contract';

export const createMockGalleryStoreSeam = (initialRecords: GalleryRecord[] = []): GalleryStoreSeam => {
  const records = [...initialRecords];

  return {
    save: async (record) => {
      records.unshift(record);
    },
    listRecent: async (limit) => records.slice(0, limit)
  };
};
