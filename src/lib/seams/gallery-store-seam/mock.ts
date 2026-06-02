// Purpose: Mock GalleryStoreSeam behavior using in-memory state.
// Why: Keep tests deterministic without live I/O; zero invented data.
// Info flow: tests -> mock -> in-memory state.
import type { GalleryRecord, GalleryStoreSeam } from './contract';

export const createMockGalleryStoreSeam = (): GalleryStoreSeam => {
  const records: GalleryRecord[] = [];

  return {
    save: async (record) => {
      records.unshift(structuredClone(record));
    },
    listRecent: async (limit) => records.slice(0, Math.max(0, limit)).map((r) => structuredClone(r))
  };
};
