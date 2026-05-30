// Purpose: Mock GalleryStoreSeam behavior using in-memory state.
// Why: Keep tests deterministic without live I/O; zero invented data.
// Info flow: tests -> mock.
import type { GalleryRecord, GalleryStoreSeam } from './contract';

export const createMockGalleryStoreSeam = (): GalleryStoreSeam => {
  const records: GalleryRecord[] = [];

  return {
    save: async (record) => {
      records.unshift(record);
    },
    listRecent: async (limit) => records.slice(0, limit)
  };
};
